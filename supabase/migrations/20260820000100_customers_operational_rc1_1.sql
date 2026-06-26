-- RC1.1 — Clientes operativos: estado de validación e historial comercial

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS validated_by text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_client_state text,
  ADD COLUMN IF NOT EXISTS legacy_migration_id integer;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_validation_status_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_validation_status_check
  CHECK (validation_status IN ('active', 'review'));

CREATE INDEX IF NOT EXISTS customers_validation_status_idx
  ON public.customers (validation_status);

CREATE INDEX IF NOT EXISTS customers_legacy_migration_id_idx
  ON public.customers (legacy_migration_id);

COMMENT ON COLUMN public.customers.validation_status IS
  'RC1.1 — Estado informativo de validación: active | review. No bloquea operación.';

COMMENT ON COLUMN public.customers.validated_by IS
  'Usuario que marcó el cliente como validado (activo).';

COMMENT ON COLUMN public.customers.validated_at IS
  'Fecha en que el cliente fue marcado como validado.';

COMMENT ON COLUMN public.customers.legacy_client_state IS
  'Estado comercial original del sistema legacy (A/B/P). Solo histórico.';

COMMENT ON COLUMN public.customers.legacy_migration_id IS
  'ID legacy (clientes.id) del dump comercial para trazabilidad.';
