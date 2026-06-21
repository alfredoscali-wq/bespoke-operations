-- Bespoke Operations — CLIENTES 1.1: allow physical delete on active customers
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push

CREATE POLICY customers_delete_policy
  ON public.customers
  FOR DELETE
  USING (deleted_at IS NULL);

COMMENT ON POLICY customers_delete_policy ON public.customers IS
  'Allows physical delete only on active (non-archived) customer rows.';
