-- Bespoke Subscriptions 1.0 — TV & Suscripciones (multi-tenant)

CREATE TABLE public.subscription_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  monthly_price numeric(12, 2) NOT NULL CHECK (monthly_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX subscription_services_company_id_idx
  ON public.subscription_services (company_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.subscription_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  service_id uuid NOT NULL REFERENCES public.subscription_services (id),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  dni text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment',
      'paid',
      'active',
      'suspended',
      'cancelled'
    )),
  activation_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX subscription_customers_company_status_idx
  ON public.subscription_customers (company_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX subscription_customers_company_service_idx
  ON public.subscription_customers (company_id, service_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.subscription_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.subscription_customers (id),
  service_id uuid NOT NULL REFERENCES public.subscription_services (id),
  seller_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  monthly_price numeric(12, 2) NOT NULL CHECK (monthly_price >= 0),
  first_invoice_amount numeric(12, 2) NOT NULL CHECK (first_invoice_amount >= 0),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX subscription_sales_company_date_idx
  ON public.subscription_sales (company_id, sale_date DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE public.subscription_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  sale_id uuid NOT NULL REFERENCES public.subscription_sales (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  commission_amount numeric(12, 2) NOT NULL CHECK (commission_amount >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX subscription_commissions_company_status_idx
  ON public.subscription_commissions (company_id, status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscription_services_set_updated_at
  BEFORE UPDATE ON public.subscription_services
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

CREATE TRIGGER subscription_customers_set_updated_at
  BEFORE UPDATE ON public.subscription_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

CREATE TRIGGER subscription_sales_set_updated_at
  BEFORE UPDATE ON public.subscription_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

CREATE TRIGGER subscription_commissions_set_updated_at
  BEFORE UPDATE ON public.subscription_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

-- Seed Bespoke TV for every company
INSERT INTO public.subscription_services (
  company_id, name, description, monthly_price, is_active
)
SELECT
  c.id,
  'Bespoke TV',
  'Servicio de TV por suscripción mensual.',
  20000.00,
  true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_services s
  WHERE s.company_id = c.id
    AND s.name = 'Bespoke TV'
    AND s.deleted_at IS NULL
);

-- RLS
ALTER TABLE public.subscription_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_services_select_policy
  ON public.subscription_services FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  );

CREATE POLICY subscription_services_insert_policy
  ON public.subscription_services FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY subscription_services_update_policy
  ON public.subscription_services FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY subscription_customers_select_policy
  ON public.subscription_customers FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  );

CREATE POLICY subscription_customers_insert_policy
  ON public.subscription_customers FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY subscription_customers_update_policy
  ON public.subscription_customers FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY subscription_sales_select_policy
  ON public.subscription_sales FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  );

CREATE POLICY subscription_sales_insert_policy
  ON public.subscription_sales FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY subscription_sales_update_policy
  ON public.subscription_sales FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY subscription_commissions_select_policy
  ON public.subscription_commissions FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  );

CREATE POLICY subscription_commissions_insert_policy
  ON public.subscription_commissions FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY subscription_commissions_update_policy
  ON public.subscription_commissions FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

COMMENT ON TABLE public.subscription_services IS
  'Catalog of recurring subscription services (e.g. Bespoke TV).';
COMMENT ON TABLE public.subscription_customers IS
  'Subscription subscribers / pre-altas. Soft-deleted via deleted_at.';
