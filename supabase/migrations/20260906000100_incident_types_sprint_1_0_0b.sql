-- Sprint 1.0.0B — Tipos de Incidencia (multi-tenant)

CREATE TABLE IF NOT EXISTS public.incident_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#64748b',
  pauses_work_order boolean NOT NULL DEFAULT true,
  requires_supervisor_intervention boolean NOT NULL DEFAULT false,
  notify_supervisor boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_types_code_not_blank
    CHECK (char_length(trim(code)) > 0),
  CONSTRAINT incident_types_name_not_blank
    CHECK (char_length(trim(name)) > 0),
  CONSTRAINT incident_types_color_valid
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT incident_types_sort_order_positive
    CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS incident_types_company_code_unique
  ON public.incident_types (company_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS incident_types_company_sort_order_unique
  ON public.incident_types (company_id, sort_order);

CREATE INDEX IF NOT EXISTS incident_types_company_active_idx
  ON public.incident_types (company_id, is_active, sort_order);

COMMENT ON TABLE public.incident_types IS
  'Tenant-configurable incident types consumed by Field Agent during work order execution.';

COMMENT ON COLUMN public.incident_types.code IS
  'Stable slug referenced by tasks.incident_reason when an incident is reported.';

COMMENT ON COLUMN public.incident_types.requires_supervisor_intervention IS
  'When true, reporting this incident type requires supervisor intervention. Resolution workflow is a future sprint.';

CREATE OR REPLACE FUNCTION public.set_incident_types_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incident_types_set_updated_at ON public.incident_types;

CREATE TRIGGER incident_types_set_updated_at
  BEFORE UPDATE ON public.incident_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_incident_types_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_manage_incident_types()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'system_role') IN ('administrador', 'supervisor'),
    false
  )
  AND NOT public.auth_is_demo_platform_read_only();
$$;

COMMENT ON FUNCTION public.auth_can_manage_incident_types() IS
  'True when the authenticated user may edit incident type configuration.';

ALTER TABLE public.incident_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY incident_types_select_policy
  ON public.incident_types
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

CREATE POLICY incident_types_insert_policy
  ON public.incident_types
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_incident_types()
  );

CREATE POLICY incident_types_update_policy
  ON public.incident_types
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_incident_types()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_incident_types()
  );

CREATE POLICY incident_types_delete_policy
  ON public.incident_types
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_incident_types()
  );
