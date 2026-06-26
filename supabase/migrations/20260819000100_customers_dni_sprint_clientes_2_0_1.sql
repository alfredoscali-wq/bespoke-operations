-- SPRINT CLIENTES 2.0.1 — DNI del abonado (sistema comercial externo)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS dni text;

CREATE INDEX IF NOT EXISTS customers_dni_idx
  ON public.customers (dni);

COMMENT ON COLUMN public.customers.dni IS
  'Documento del abonado según el sistema comercial externo.';
