-- Queue of TV altas that start from a Bespoke installation work order.
-- A proposal is not a padrón row. Exclusion is logical and stays keyed by
-- customer + OT, so a later OT for the same customer is a new case.
-- abnet_tv_padron_rows.abnet_customer_number stays NOT NULL. This migration
-- does not invent subscriber numbers and does not write Latam.

CREATE TABLE public.tv_ot_signup_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  task_id uuid NOT NULL REFERENCES public.tasks (id),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN (
      'pending_review',
      'pending_required_data',
      'incorporated',
      'excluded',
      'needs_review'
    )),
  tv_kind text
    CHECK (tv_kind IS NULL OR tv_kind IN ('basica', 'pack', 'full')),
  abnet_customer_number text
    CHECK (
      abnet_customer_number IS NULL
      OR abnet_customer_number ~ '^[1-9][0-9]*$'
    ),
  padron_source text,
  padron_source_row integer
    CHECK (padron_source_row IS NULL OR padron_source_row > 0),
  incorporated_at timestamptz,
  incorporated_by uuid,
  excluded_at timestamptz,
  excluded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_ot_signup_proposals_case_unique
    UNIQUE (company_id, customer_id, task_id),
  CONSTRAINT tv_ot_signup_proposals_exclusion_chk CHECK (
    (
      status = 'excluded'
      AND excluded_at IS NOT NULL
      AND excluded_by IS NOT NULL
    )
    OR (
      status <> 'excluded'
      AND excluded_at IS NULL
      AND excluded_by IS NULL
    )
  ),
  CONSTRAINT tv_ot_signup_proposals_incorporated_chk CHECK (
    (
      status = 'incorporated'
      AND incorporated_at IS NOT NULL
      AND incorporated_by IS NOT NULL
      AND tv_kind IS NOT NULL
    )
    OR status <> 'incorporated'
  )
);

COMMENT ON TABLE public.tv_ot_signup_proposals IS
  'Pending TV alta for one Bespoke customer and one installation OT. Excluding a row hides that case only.';

CREATE INDEX tv_ot_signup_proposals_company_status_idx
  ON public.tv_ot_signup_proposals (company_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_tv_ot_signup_proposal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'tv_ot_signup_identity_locked';
  END IF;

  IF OLD.status = 'excluded' AND NEW.status IS DISTINCT FROM 'excluded' THEN
    RAISE EXCEPTION 'tv_ot_signup_exclusion_locked';
  END IF;

  IF OLD.status = 'incorporated' AND (
    NEW.status IS DISTINCT FROM 'incorporated'
    OR NEW.tv_kind IS DISTINCT FROM OLD.tv_kind
  ) THEN
    RAISE EXCEPTION 'tv_ot_signup_incorporation_locked';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tv_ot_signup_proposals_guard
  ON public.tv_ot_signup_proposals;

CREATE TRIGGER tv_ot_signup_proposals_guard
  BEFORE UPDATE ON public.tv_ot_signup_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tv_ot_signup_proposal();

ALTER TABLE public.tv_ot_signup_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY tv_ot_signup_proposals_select_policy
  ON public.tv_ot_signup_proposals
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  );

CREATE POLICY tv_ot_signup_proposals_insert_policy
  ON public.tv_ot_signup_proposals
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
  );

CREATE POLICY tv_ot_signup_proposals_update_policy
  ON public.tv_ot_signup_proposals
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
  );

GRANT SELECT, INSERT, UPDATE ON public.tv_ot_signup_proposals TO authenticated;

-- Operator rows created from an OT once a verified ABNet number exists.
-- The Excel source stays untouched. A duplicate number is rejected.

CREATE UNIQUE INDEX abnet_tv_padron_rows_ot_signup_number_uidx
  ON public.abnet_tv_padron_rows (company_id, abnet_customer_number)
  WHERE source = 'bespoke-ot-tv';

CREATE OR REPLACE FUNCTION public.guard_bespoke_ot_tv_padron_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source IS DISTINCT FROM 'bespoke-ot-tv' THEN
    RAISE EXCEPTION 'tv_ot_padron_source_rejected';
  END IF;
  IF btrim(coalesce(NEW.abnet_customer_number, '')) = ''
    OR btrim(coalesce(NEW.customer_name, '')) = ''
  THEN
    RAISE EXCEPTION 'tv_ot_padron_incomplete';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers customer
    WHERE customer.company_id = NEW.company_id
      AND customer.deleted_at IS NULL
      AND customer.external_customer_code ~ '^[0-9]+$'
      AND ltrim(customer.external_customer_code, '0') = ltrim(NEW.abnet_customer_number, '0')
  ) THEN
    RAISE EXCEPTION 'tv_ot_padron_unverified_number';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.abnet_tv_padron_rows existing
    WHERE existing.company_id = NEW.company_id
      AND ltrim(existing.abnet_customer_number, '0') = ltrim(NEW.abnet_customer_number, '0')
      AND NOT (
        existing.source = NEW.source
        AND existing.source_row = NEW.source_row
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.abnet_tv_padron_exclusions ex
        WHERE ex.company_id = existing.company_id
          AND ex.source = existing.source
          AND ex.source_row = existing.source_row
          AND ex.deleted_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'tv_ot_padron_duplicate_number';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS abnet_tv_padron_rows_ot_signup_guard
  ON public.abnet_tv_padron_rows;

CREATE TRIGGER abnet_tv_padron_rows_ot_signup_guard
  BEFORE INSERT ON public.abnet_tv_padron_rows
  FOR EACH ROW
  WHEN (NEW.source = 'bespoke-ot-tv')
  EXECUTE FUNCTION public.guard_bespoke_ot_tv_padron_row();

CREATE POLICY abnet_tv_padron_rows_insert_ot_signup
  ON public.abnet_tv_padron_rows
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND source = 'bespoke-ot-tv'
    AND btrim(abnet_customer_number) <> ''
    AND btrim(customer_name) <> ''
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
  );

GRANT INSERT ON public.abnet_tv_padron_rows TO authenticated;
