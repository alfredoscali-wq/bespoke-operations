-- ISP 1.6C — Monthly billing cycle: prepare → review → confirm → issue.
-- Additive only. Does not call ARCA/SIRO, auto-issue on day 1, or prorate cancellations.

ALTER TABLE public.isp_billing_company_settings
  ADD COLUMN IF NOT EXISTS auto_prepare_day_one boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.isp_billing_company_settings.auto_prepare_day_one IS
  'Reserved for future day-1 auto-prepare. ISP 1.6C never auto-prepares or auto-issues. Human confirmation remains required.';

CREATE TABLE public.isp_billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  period_year integer NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  status text NOT NULL DEFAULT 'preparing'
    CHECK (status IN (
      'preparing',
      'in_review',
      'with_errors',
      'confirmed',
      'cancelled'
    )),
  prepared_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  total_customers integer NOT NULL DEFAULT 0 CHECK (total_customers >= 0),
  total_documents integer NOT NULL DEFAULT 0 CHECK (total_documents >= 0),
  total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  proportional_documents integer NOT NULL DEFAULT 0 CHECK (proportional_documents >= 0),
  errors_count integer NOT NULL DEFAULT 0 CHECK (errors_count >= 0),
  warnings_count integer NOT NULL DEFAULT 0 CHECK (warnings_count >= 0),
  created_by uuid,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_billing_runs_period_unique
    UNIQUE (company_id, period_year, period_month)
);

COMMENT ON TABLE public.isp_billing_runs IS
  'Monthly billing runs. Prepare generates a review; confirm issues documents. No ARCA/SIRO.';
COMMENT ON COLUMN public.isp_billing_runs.status IS
  'preparing | in_review | with_errors | confirmed | cancelled. Confirmed runs cannot be prepared again.';

CREATE INDEX isp_billing_runs_company_period_idx
  ON public.isp_billing_runs (company_id, period_year DESC, period_month DESC);

CREATE TABLE public.isp_billing_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.isp_billing_runs (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  subscriber_id uuid REFERENCES public.isp_subscribers (id),
  service_id uuid NOT NULL REFERENCES public.isp_services (id),
  document_type text
    CHECK (document_type IS NULL OR document_type IN (
      'factura_a',
      'factura_b',
      'factura_c',
      'comprobante_x',
      'presupuesto',
      'nota_credito',
      'nota_debito'
    )),
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN (
      'ready',
      'error',
      'needs_review',
      'billed'
    )),
  customer_name text NOT NULL DEFAULT '',
  service_name text NOT NULL DEFAULT '',
  catalog_code text,
  activation_date date,
  list_price numeric(14, 2),
  monthly_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  proportional_days integer NOT NULL DEFAULT 0 CHECK (proportional_days >= 0),
  proportional_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (proportional_amount >= 0),
  proportional_period_label text NOT NULL DEFAULT '',
  total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  error_code text,
  error_message text,
  suggested_action text,
  warning_code text,
  warning_message text,
  requires_review boolean NOT NULL DEFAULT false,
  concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_id uuid REFERENCES public.isp_billing_documents (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_billing_run_items_service_unique UNIQUE (run_id, service_id)
);

COMMENT ON TABLE public.isp_billing_run_items IS
  'Per-service preview lines of a monthly run. Grouped by customer into one document on confirm. list_price is stored only for audit and is never billed.';
COMMENT ON COLUMN public.isp_billing_run_items.monthly_amount IS
  'Contracted monthly_fee of the ISP service. Never list_price.';
COMMENT ON COLUMN public.isp_billing_run_items.requires_review IS
  'Includes cancellation cases whose proration policy is not defined yet.';

CREATE INDEX isp_billing_run_items_run_idx
  ON public.isp_billing_run_items (run_id, customer_id);
CREATE INDEX isp_billing_run_items_company_idx
  ON public.isp_billing_run_items (company_id);
CREATE INDEX isp_billing_run_items_document_idx
  ON public.isp_billing_run_items (document_id);

ALTER TABLE public.isp_billing_documents
  ADD COLUMN IF NOT EXISTS billing_run_id uuid REFERENCES public.isp_billing_runs (id),
  ADD COLUMN IF NOT EXISTS period_year integer,
  ADD COLUMN IF NOT EXISTS period_month integer;

COMMENT ON COLUMN public.isp_billing_documents.billing_run_id IS
  'Set when the document was generated by a monthly billing run.';

CREATE UNIQUE INDEX isp_billing_documents_run_customer_unique
  ON public.isp_billing_documents (company_id, period_year, period_month, customer_id)
  WHERE billing_run_id IS NOT NULL AND status <> 'cancelled';

CREATE INDEX isp_billing_documents_run_idx
  ON public.isp_billing_documents (billing_run_id)
  WHERE billing_run_id IS NOT NULL;

CREATE TRIGGER isp_billing_runs_set_updated_at
  BEFORE UPDATE ON public.isp_billing_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_isp_billing_run_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM public.auth_user_company_id()
     AND public.auth_user_company_id() IS NOT NULL THEN
    RAISE EXCEPTION 'La corrida no puede asociarse a otra empresa.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_billing_runs_enforce_company
  BEFORE INSERT OR UPDATE ON public.isp_billing_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_billing_run_company_match();

CREATE OR REPLACE FUNCTION public.enforce_isp_billing_run_item_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_company uuid;
  v_service_company uuid;
  v_customer_company uuid;
BEGIN
  SELECT company_id INTO v_run_company
  FROM public.isp_billing_runs
  WHERE id = NEW.run_id;

  SELECT company_id INTO v_service_company
  FROM public.isp_services
  WHERE id = NEW.service_id;

  SELECT company_id INTO v_customer_company
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_run_company IS DISTINCT FROM NEW.company_id
     OR v_service_company IS DISTINCT FROM NEW.company_id
     OR v_customer_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El ítem de facturación no puede asociarse a datos de otra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_billing_run_items_enforce_company
  BEFORE INSERT OR UPDATE ON public.isp_billing_run_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_billing_run_item_match();

ALTER TABLE public.isp_billing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_billing_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_billing_runs_select_policy
  ON public.isp_billing_runs
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_runs_write_policy
  ON public.isp_billing_runs
  FOR ALL
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_billing_run_items_select_policy
  ON public.isp_billing_run_items
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_run_items_write_policy
  ON public.isp_billing_run_items
  FOR ALL
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.isp_billing_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.isp_billing_run_items TO authenticated;
