-- Logical removal from the ABNet TV padrón.
-- Does not delete customers, isp_subscribers, isp_services, isp_connections,
-- tasks, customer_atenciones, or the original Excel rows.
-- deleted_at IS NULL means the padron row stays hidden.
-- deleted_at IS NOT NULL revokes that exclusion for a future restore.

CREATE TABLE public.abnet_tv_padron_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  source text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  abnet_customer_number text NOT NULL,
  action text NOT NULL DEFAULT 'remove_from_tv_padron'
    CHECK (action = 'remove_from_tv_padron'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  deleted_at timestamptz
);

COMMENT ON TABLE public.abnet_tv_padron_exclusions IS
  'Rows hidden from the active ABNet TV padrón. The source file and Bespoke customers stay intact.';

CREATE UNIQUE INDEX abnet_tv_padron_exclusions_active_row_uidx
  ON public.abnet_tv_padron_exclusions (company_id, source, source_row)
  WHERE deleted_at IS NULL;

CREATE INDEX abnet_tv_padron_exclusions_company_idx
  ON public.abnet_tv_padron_exclusions (company_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.abnet_tv_padron_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY abnet_tv_padron_exclusions_select_policy
  ON public.abnet_tv_padron_exclusions
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('subscriptions')
      OR public.auth_user_has_allowed_module('clientes_360')
    )
  );

CREATE POLICY abnet_tv_padron_exclusions_insert_policy
  ON public.abnet_tv_padron_exclusions
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND created_by = auth.uid()
    AND action = 'remove_from_tv_padron'
    AND deleted_at IS NULL
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
  );

GRANT SELECT, INSERT ON public.abnet_tv_padron_exclusions TO authenticated;
