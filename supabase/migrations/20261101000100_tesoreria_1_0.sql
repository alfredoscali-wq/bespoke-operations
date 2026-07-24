-- Tesorería 1.0 — Operational money movements (not accounting).
-- Soft-delete SELECT follows crews/tasks pattern (no deleted_at gate on SELECT).

CREATE TYPE public.treasury_movement_type AS ENUM (
  'income',
  'expense'
);

CREATE TYPE public.treasury_movement_origin AS ENUM (
  'manual',
  'task',
  'sales',
  'customer_service',
  'administration'
);

CREATE TYPE public.treasury_movement_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled'
);

CREATE TABLE public.treasury_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  movement_type public.treasury_movement_type NOT NULL,
  origin public.treasury_movement_origin NOT NULL DEFAULT 'manual',
  category text NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  movement_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  registered_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  status public.treasury_movement_status NOT NULL DEFAULT 'confirmed',
  notes text NOT NULL DEFAULT '',
  receipt_url text,
  -- Reserved for Tesorería 2.0 (multi-cashbox / banks) — unused in 1.0.
  cashbox_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX treasury_movements_company_id_idx
  ON public.treasury_movements (company_id);

CREATE INDEX treasury_movements_company_date_idx
  ON public.treasury_movements (company_id, movement_date DESC);

CREATE INDEX treasury_movements_company_status_idx
  ON public.treasury_movements (company_id, status);

CREATE INDEX treasury_movements_company_type_idx
  ON public.treasury_movements (company_id, movement_type);

CREATE INDEX treasury_movements_employee_id_idx
  ON public.treasury_movements (employee_id);

CREATE INDEX treasury_movements_deleted_at_idx
  ON public.treasury_movements (deleted_at);

CREATE OR REPLACE FUNCTION public.set_treasury_movements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER treasury_movements_set_updated_at
  BEFORE UPDATE ON public.treasury_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_treasury_movements_updated_at();

COMMENT ON TABLE public.treasury_movements IS
  'Operational treasury movements (income/expense). Not an accounting ledger.';
COMMENT ON COLUMN public.treasury_movements.cashbox_id IS
  'Reserved for Tesorería 2.0 multi-cashbox. Null in 1.0.';
COMMENT ON COLUMN public.treasury_movements.metadata IS
  'Extensible JSON for future reconciliations / integrations.';

ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;

-- SELECT: any user with tesoreria module (includes supervisor read-only).
CREATE POLICY treasury_movements_select_policy
  ON public.treasury_movements
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
  );

-- Writes: administrador + administrativo (Administración). Supervisor = read-only.
CREATE POLICY treasury_movements_insert_policy
  ON public.treasury_movements
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY treasury_movements_update_policy
  ON public.treasury_movements
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
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

-- Storage bucket for optional receipt images.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'treasury-receipts',
  'treasury-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY treasury_receipts_select_policy
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'treasury-receipts'
    AND public.auth_user_has_allowed_module('tesoreria')
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  );

CREATE POLICY treasury_receipts_insert_policy
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'treasury-receipts'
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  );

CREATE POLICY treasury_receipts_update_policy
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'treasury-receipts'
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'treasury-receipts'
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  );

-- Seed module visibility defaults for existing roles.
UPDATE public.company_roles
SET module_visibility = module_visibility || '{"tesoreria": true}'::jsonb
WHERE code IN ('administrador', 'administracion');

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"tesoreria": true}'::jsonb
WHERE code IN ('tecnica', 'supervisor');

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"tesoreria": false}'::jsonb
WHERE code IN ('operario');
