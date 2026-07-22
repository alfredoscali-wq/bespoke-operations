-- Contratistas y Cuadrillas Externas
-- External crews reuse public.crews so OT assignment and Field Agent stay unchanged.

CREATE TYPE public.contractor_status AS ENUM (
  'activo',
  'inactivo'
);

CREATE TYPE public.crew_origin AS ENUM (
  'internal',
  'external'
);

CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  legal_name text NOT NULL,
  trade_name text NOT NULL DEFAULT '',
  tax_id text NOT NULL,
  responsible_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  status public.contractor_status NOT NULL DEFAULT 'activo',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT contractors_company_tax_id_unique UNIQUE (company_id, tax_id)
);

CREATE INDEX contractors_company_id_idx ON public.contractors (company_id);
CREATE INDEX contractors_company_status_idx ON public.contractors (company_id, status);
CREATE INDEX contractors_deleted_at_idx ON public.contractors (deleted_at);

CREATE OR REPLACE FUNCTION public.set_contractors_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractors_set_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contractors_updated_at();

COMMENT ON TABLE public.contractors IS
  'External contractor companies that execute OTs via external crews.';

ALTER TABLE public.crews
  ADD COLUMN origin public.crew_origin NOT NULL DEFAULT 'internal',
  ADD COLUMN contractor_id uuid REFERENCES public.contractors (id) ON DELETE RESTRICT;

CREATE INDEX crews_origin_idx ON public.crews (company_id, origin);
CREATE INDEX crews_contractor_id_idx ON public.crews (contractor_id);

ALTER TABLE public.crews
  ADD CONSTRAINT crews_external_requires_contractor CHECK (
    (origin = 'internal' AND contractor_id IS NULL)
    OR (origin = 'external' AND contractor_id IS NOT NULL)
  );

ALTER TABLE public.employees
  ADD COLUMN contractor_id uuid REFERENCES public.contractors (id) ON DELETE RESTRICT;

CREATE INDEX employees_contractor_id_idx ON public.employees (contractor_id);

COMMENT ON COLUMN public.crews.origin IS
  'internal = company crew; external = contractor crew (same operational model).';
COMMENT ON COLUMN public.crews.contractor_id IS
  'Set only when origin = external.';
COMMENT ON COLUMN public.employees.contractor_id IS
  'When set, employee is an external contractor user (Field Agent only).';

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY contractors_select_policy
  ON public.contractors
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('contractors')
  );

CREATE POLICY contractors_insert_policy
  ON public.contractors
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('contractors')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY contractors_update_policy
  ON public.contractors
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('contractors')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('contractors')
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- Enable contractors module for Administrador (full ABM).
UPDATE public.company_roles
SET module_visibility = module_visibility || '{"contractors": true}'::jsonb
WHERE code = 'administrador';
