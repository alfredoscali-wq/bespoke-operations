-- Tesorería — physical cash opening balance, separate from treasury_movements.
-- Opening cash is not an income, does not appear in Historial, and is not cobranza OT.

CREATE TABLE public.treasury_cash_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  opening_balance numeric(14, 2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  as_of_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  notes text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.treasury_cash_settings IS
  'Physical cash opening/base per tenant. Not a treasury movement and not period income.';
COMMENT ON COLUMN public.treasury_cash_settings.opening_balance IS
  'Cash counted in the box at the start of as_of_date. Later physical-cash movements apply on top.';
COMMENT ON COLUMN public.treasury_cash_settings.as_of_date IS
  'Inclusive date from which confirmed efectivo incomes/expenses and all withdrawals affect Dinero en Caja.';

CREATE OR REPLACE FUNCTION public.set_treasury_cash_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER treasury_cash_settings_set_updated_at
  BEFORE UPDATE ON public.treasury_cash_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_treasury_cash_settings_updated_at();

ALTER TABLE public.treasury_cash_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY treasury_cash_settings_select_policy
  ON public.treasury_cash_settings
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
  );

CREATE POLICY treasury_cash_settings_insert_policy
  ON public.treasury_cash_settings
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY treasury_cash_settings_update_policy
  ON public.treasury_cash_settings
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.treasury_cash_settings TO authenticated;
