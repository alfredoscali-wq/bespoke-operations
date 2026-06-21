-- Bespoke Operations — CLIENTES 1 FASE 1: external code + soft delete on customers
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS external_customer_code text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX customers_external_customer_code_idx
  ON public.customers (external_customer_code);

CREATE INDEX customers_deleted_at_idx
  ON public.customers (deleted_at);

COMMENT ON COLUMN public.customers.external_customer_code IS
  'External subscriber / CRM reference code (nullable).';

COMMENT ON COLUMN public.customers.deleted_at IS
  'Soft delete timestamp; excluded from operational queries.';

DROP POLICY IF EXISTS customers_select_policy ON public.customers;

CREATE POLICY customers_select_policy
  ON public.customers
  FOR SELECT
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS customers_update_policy ON public.customers;

CREATE POLICY customers_update_policy
  ON public.customers
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (true);

COMMENT ON POLICY customers_update_policy ON public.customers IS
  'Allows updates on active rows, including soft delete (deleted_at).';
