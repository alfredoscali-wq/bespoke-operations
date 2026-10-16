-- WhatsApp commercial requests for TV & Suscripciones.
-- Additive. Does not change the padrón, LATAM, customers, or Atención al Cliente.
-- Marking a request completed only stores the operator decision. It does not
-- change a LATAM plan or a commercial price.

CREATE TABLE public.tv_whatsapp_commercial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid REFERENCES public.customers (id),
  identity_status text NOT NULL
    CHECK (identity_status IN ('unverified', 'verified')),
  origin_phone text NOT NULL,
  offer text NOT NULL
    CHECK (offer IN ('basica', 'pack', 'full')),
  current_plan_label text,
  destination_plan_label text,
  quoted_monthly_fee numeric(12, 2)
    CHECK (quoted_monthly_fee IS NULL OR quoted_monthly_fee >= 0),
  quoted_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_accepted boolean,
  customer_accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'approved', 'completed', 'rejected')),
  operator_result text,
  operator_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_whatsapp_identity_link_chk CHECK (
    (
      identity_status = 'unverified'
      AND customer_id IS NULL
    )
    OR (
      identity_status = 'verified'
      AND customer_id IS NOT NULL
    )
  )
);

COMMENT ON TABLE public.tv_whatsapp_commercial_requests IS
  'Operator inbox for WhatsApp commercial TV requests. Completing a row does not change LATAM or the padrón.';
COMMENT ON COLUMN public.tv_whatsapp_commercial_requests.quoted_monthly_fee IS
  'Catalog quote shown for this request. Frozen after insert so later catalog prices do not rewrite it.';
COMMENT ON COLUMN public.tv_whatsapp_commercial_requests.customer_id IS
  'Set only when identity was verified. A shared or unverified phone stays null.';

CREATE INDEX tv_whatsapp_commercial_requests_company_status_idx
  ON public.tv_whatsapp_commercial_requests (company_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_tv_whatsapp_commercial_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.identity_status IS DISTINCT FROM OLD.identity_status
    OR NEW.origin_phone IS DISTINCT FROM OLD.origin_phone
    OR NEW.offer IS DISTINCT FROM OLD.offer
    OR NEW.current_plan_label IS DISTINCT FROM OLD.current_plan_label
    OR NEW.destination_plan_label IS DISTINCT FROM OLD.destination_plan_label
    OR NEW.quoted_monthly_fee IS DISTINCT FROM OLD.quoted_monthly_fee
    OR NEW.quoted_components IS DISTINCT FROM OLD.quoted_components
    OR NEW.customer_accepted IS DISTINCT FROM OLD.customer_accepted
    OR NEW.customer_accepted_at IS DISTINCT FROM OLD.customer_accepted_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'whatsapp_request_snapshot_locked';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (
      (OLD.status = 'pending' AND NEW.status IN ('in_review', 'rejected'))
      OR (OLD.status = 'in_review' AND NEW.status IN ('approved', 'rejected'))
      OR (OLD.status = 'approved' AND NEW.status IN ('completed', 'rejected'))
    )
  THEN
    RAISE EXCEPTION 'whatsapp_request_invalid_transition';
  END IF;

  IF NEW.status IN ('approved', 'completed', 'rejected')
    AND btrim(coalesce(NEW.operator_notes, '')) = ''
  THEN
    RAISE EXCEPTION 'whatsapp_request_notes_required';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tv_whatsapp_commercial_requests_guard
  ON public.tv_whatsapp_commercial_requests;

CREATE TRIGGER tv_whatsapp_commercial_requests_guard
  BEFORE UPDATE ON public.tv_whatsapp_commercial_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tv_whatsapp_commercial_request();

ALTER TABLE public.tv_whatsapp_commercial_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tv_whatsapp_commercial_requests_select_policy
  ON public.tv_whatsapp_commercial_requests
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  );

CREATE POLICY tv_whatsapp_commercial_requests_update_policy
  ON public.tv_whatsapp_commercial_requests
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

GRANT SELECT, UPDATE ON public.tv_whatsapp_commercial_requests TO authenticated;
