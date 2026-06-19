-- Bespoke Operations — CLIENTES 0: customers master + task link
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  locality text,
  technology text,
  status text NOT NULL DEFAULT 'activo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customers_name_idx ON public.customers (name);
CREATE INDEX customers_phone_idx ON public.customers (phone);
CREATE INDEX customers_number_idx ON public.customers (customer_number);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL;

CREATE INDEX tasks_customer_id_idx ON public.tasks (customer_id);

CREATE OR REPLACE FUNCTION public.set_customers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customers_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_select_policy
  ON public.customers
  FOR SELECT
  USING (true);

CREATE POLICY customers_insert_policy
  ON public.customers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY customers_update_policy
  ON public.customers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.customers IS 'ISP subscriber / end customer master directory.';
COMMENT ON COLUMN public.customers.customer_number IS 'Human-readable unique code (CLI-000001).';
COMMENT ON COLUMN public.tasks.customer_id IS 'Optional link to customers; legacy snapshot fields remain for history.';
