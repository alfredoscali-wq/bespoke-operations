-- Bespoke Operations — AUTH 1.0A: employees system access (Phase 1)
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: employees + employee_type migrations applied first

CREATE TYPE public.system_role AS ENUM (
  'administrador',
  'supervisor',
  'administrativo',
  'operario'
);

ALTER TABLE public.employees
  ADD COLUMN system_role public.system_role NOT NULL DEFAULT 'operario',
  ADD COLUMN system_access boolean NOT NULL DEFAULT false,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN last_login_at timestamptz;

UPDATE public.employees
SET system_role = CASE employee_type
  WHEN 'operario' THEN 'operario'::public.system_role
  WHEN 'supervisor' THEN 'supervisor'::public.system_role
  WHEN 'administrativo' THEN 'administrativo'::public.system_role
  WHEN 'gerente' THEN 'administrador'::public.system_role
  ELSE 'operario'::public.system_role
END
WHERE deleted_at IS NULL;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_app_user_id_fkey
  FOREIGN KEY (app_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX employees_app_user_id_unique
  ON public.employees (app_user_id)
  WHERE app_user_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TYPE public.system_role IS 'Application access role for authenticated employees.';
COMMENT ON COLUMN public.employees.system_role IS 'Role used for application authorization (AUTH).';
COMMENT ON COLUMN public.employees.system_access IS 'Whether the employee is allowed to authenticate.';
COMMENT ON COLUMN public.employees.must_change_password IS 'Force password change on next login.';
COMMENT ON COLUMN public.employees.last_login_at IS 'Timestamp of the last successful login.';
COMMENT ON COLUMN public.employees.app_user_id IS 'Link to Supabase Auth user (auth.users.id).';
