-- Read model of the ABNet TV padrón (Conex. Internet + TV.xlsx).
-- One row per Excel line. Duplicate N° Cliente are kept.
-- Does not create isp_services, isp_connections, customers or catalog plans.

CREATE TABLE public.abnet_tv_padron_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  abnet_customer_number text NOT NULL,
  customer_name text NOT NULL,
  service_type text,
  node text,
  plan_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  tv_amount numeric(12, 2),
  tv_tax_amount numeric(12, 2),
  final_amount numeric(12, 2),
  source text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  loaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT abnet_tv_padron_rows_source_row_unique
    UNIQUE (company_id, source, source_row)
);

COMMENT ON TABLE public.abnet_tv_padron_rows IS
  'Source rows from the ABNet TV padrón. Not isp_services and not a commercial catalog.';

CREATE INDEX abnet_tv_padron_rows_company_number_idx
  ON public.abnet_tv_padron_rows (company_id, abnet_customer_number);

ALTER TABLE public.abnet_tv_padron_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY abnet_tv_padron_rows_select_policy
  ON public.abnet_tv_padron_rows
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('subscriptions')
      OR public.auth_user_has_allowed_module('clientes_360')
    )
  );

GRANT SELECT ON public.abnet_tv_padron_rows TO authenticated;
