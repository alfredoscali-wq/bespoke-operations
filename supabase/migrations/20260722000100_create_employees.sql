-- Bespoke Operations — RRHH Etapa 1: employees directory
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: companies migration applied first

CREATE TYPE public.employment_status AS ENUM (
  'active',
  'vacation',
  'medical_leave',
  'training',
  'suspended',
  'inactive'
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid
    REFERENCES public.companies (id),
  employee_code text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  preferred_name text,
  national_id text,
  birth_date date,
  email text,
  phone text,
  job_title text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  hire_date date,
  termination_date date,
  notes text NOT NULL DEFAULT '',
  app_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT employees_company_code_unique UNIQUE (company_id, employee_code),
  CONSTRAINT employees_company_email_unique UNIQUE (company_id, email)
);

CREATE INDEX employees_company_id_idx ON public.employees (company_id);
CREATE INDEX employees_status_idx ON public.employees (employment_status);
CREATE INDEX employees_deleted_at_idx ON public.employees (deleted_at);
CREATE INDEX employees_last_name_idx ON public.employees (last_name);
CREATE INDEX employees_employee_code_idx ON public.employees (employee_code);

CREATE OR REPLACE FUNCTION public.set_employees_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER employees_set_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employees_updated_at();

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select_policy
  ON public.employees
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY employees_insert_policy
  ON public.employees
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY employees_update_policy
  ON public.employees
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

COMMENT ON TABLE public.employees IS 'Master employee directory (RRHH). Source of truth for personnel.';
COMMENT ON COLUMN public.employees.employee_code IS 'Human-readable unique code per company.';
COMMENT ON COLUMN public.employees.preferred_name IS 'Short display name for field operations.';
COMMENT ON COLUMN public.employees.app_user_id IS 'Future link to authenticated user profile.';
