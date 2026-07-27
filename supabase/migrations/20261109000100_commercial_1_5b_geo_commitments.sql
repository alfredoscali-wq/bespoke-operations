-- Comercial 1.5b — domicilio detallado, geo en personas y compromisos comerciales.

ALTER TABLE public.commercial_people
  ADD COLUMN IF NOT EXISTS street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS street_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS floor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS apartment text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS neighborhood text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS location_source public.commercial_location_source;

ALTER TABLE public.commercial_people
  DROP CONSTRAINT IF EXISTS commercial_people_coordinates_pair_check;

ALTER TABLE public.commercial_people
  ADD CONSTRAINT commercial_people_coordinates_pair_check
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS commercial_people_company_lat_lng_idx
  ON public.commercial_people (company_id, latitude, longitude)
  WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TYPE public.commercial_commitment_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE public.commercial_commitment_priority AS ENUM (
  'alta',
  'media',
  'baja'
);

CREATE TABLE public.commercial_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  opportunity_id uuid NOT NULL REFERENCES public.commercial_opportunities (id) ON DELETE RESTRICT,
  activity_id uuid REFERENCES public.commercial_activities (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assigned_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL,
  priority public.commercial_commitment_priority NOT NULL DEFAULT 'media',
  status public.commercial_commitment_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX commercial_commitments_company_id_idx
  ON public.commercial_commitments (company_id);

CREATE INDEX commercial_commitments_opportunity_id_idx
  ON public.commercial_commitments (opportunity_id);

CREATE INDEX commercial_commitments_activity_id_idx
  ON public.commercial_commitments (activity_id);

CREATE INDEX commercial_commitments_due_at_idx
  ON public.commercial_commitments (due_at);

CREATE INDEX commercial_commitments_deleted_at_idx
  ON public.commercial_commitments (deleted_at);

CREATE OR REPLACE FUNCTION public.set_commercial_commitments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_commitments_set_updated_at
  BEFORE UPDATE ON public.commercial_commitments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_commitments_updated_at();

ALTER TABLE public.commercial_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_commitments_select_policy
  ON public.commercial_commitments
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

CREATE POLICY commercial_commitments_insert_policy
  ON public.commercial_commitments
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_commitments_update_policy
  ON public.commercial_commitments
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_commitments_delete_policy
  ON public.commercial_commitments
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND public.auth_is_administrador()
    AND NOT public.auth_is_demo_platform_read_only()
  );

COMMENT ON TABLE public.commercial_commitments IS
  'Trabajo futuro comercial (puente hacia Agenda Engine).';
