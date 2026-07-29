-- Actividad Comercial Territorial 1.0
-- Field actions by sellers (NOT opportunity timeline activities).
-- Distinct from commercial_activities / commercial_activity_types.

-- ---------------------------------------------------------------------------
-- Types catalog (per company, no seed data)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commercial_territorial_activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  icon text,
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT commercial_territorial_activity_types_name_not_blank
    CHECK (char_length(trim(name)) > 0),
  CONSTRAINT commercial_territorial_activity_types_sort_order_positive
    CHECK (sort_order > 0),
  CONSTRAINT commercial_territorial_activity_types_color_not_blank
    CHECK (char_length(trim(color)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_territorial_activity_types_company_name_active_unique
  ON public.commercial_territorial_activity_types (company_id, lower(trim(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_territorial_activity_types_company_active_idx
  ON public.commercial_territorial_activity_types (company_id, is_active, sort_order)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.commercial_territorial_activity_types IS
  'Tenant-configurable types for Actividad Comercial Territorial (field actions).';
COMMENT ON COLUMN public.commercial_territorial_activity_types.icon IS
  'Optional icon key for future marker customization; unused in 1.0 UI.';

CREATE OR REPLACE FUNCTION public.set_commercial_territorial_activity_types_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_territorial_activity_types_set_updated_at
  ON public.commercial_territorial_activity_types;
CREATE TRIGGER commercial_territorial_activity_types_set_updated_at
  BEFORE UPDATE ON public.commercial_territorial_activity_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_territorial_activity_types_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_manage_commercial_territorial_activity_types()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.auth_user_system_role() = 'supervisor'
    OR public.auth_user_has_allowed_module('settings')
  )
  AND NOT public.auth_is_demo_platform_read_only();
$$;

ALTER TABLE public.commercial_territorial_activity_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_territorial_activity_types_select_policy
  ON public.commercial_territorial_activity_types;
CREATE POLICY commercial_territorial_activity_types_select_policy
  ON public.commercial_territorial_activity_types
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS commercial_territorial_activity_types_insert_policy
  ON public.commercial_territorial_activity_types;
CREATE POLICY commercial_territorial_activity_types_insert_policy
  ON public.commercial_territorial_activity_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_territorial_activity_types()
  );

DROP POLICY IF EXISTS commercial_territorial_activity_types_update_policy
  ON public.commercial_territorial_activity_types;
CREATE POLICY commercial_territorial_activity_types_update_policy
  ON public.commercial_territorial_activity_types
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_territorial_activity_types()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_territorial_activity_types()
  );

DROP POLICY IF EXISTS commercial_territorial_activity_types_delete_policy
  ON public.commercial_territorial_activity_types;
CREATE POLICY commercial_territorial_activity_types_delete_policy
  ON public.commercial_territorial_activity_types
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_territorial_activity_types()
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commercial_territorial_activity_types TO authenticated;
GRANT ALL ON TABLE public.commercial_territorial_activity_types TO service_role;

-- ---------------------------------------------------------------------------
-- Activities (georeferenced field actions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commercial_territorial_activity_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE RESTRICT,
  last_number integer NOT NULL DEFAULT 0,
  CONSTRAINT commercial_territorial_activity_counters_last_number_non_negative
    CHECK (last_number >= 0)
);

CREATE TABLE IF NOT EXISTS public.commercial_territorial_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  code text NOT NULL,
  activity_type_id uuid NOT NULL
    REFERENCES public.commercial_territorial_activity_types (id) ON DELETE RESTRICT,
  description text NOT NULL,
  observations text NOT NULL DEFAULT '',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_source text,
  -- Prepared for future sprint: optional related client (opportunity). Not used in 1.0 UI.
  related_opportunity_id uuid
    REFERENCES public.commercial_opportunities (id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT commercial_territorial_activities_description_not_blank
    CHECK (char_length(trim(description)) > 0),
  CONSTRAINT commercial_territorial_activities_latitude_range
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT commercial_territorial_activities_longitude_range
    CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT commercial_territorial_activities_company_code_unique
    UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS commercial_territorial_activities_company_created_idx
  ON public.commercial_territorial_activities (company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_territorial_activities_type_idx
  ON public.commercial_territorial_activities (activity_type_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_territorial_activities_employee_idx
  ON public.commercial_territorial_activities (employee_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_territorial_activities_geo_idx
  ON public.commercial_territorial_activities (company_id, latitude, longitude)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_territorial_activities_related_opportunity_idx
  ON public.commercial_territorial_activities (related_opportunity_id)
  WHERE deleted_at IS NULL AND related_opportunity_id IS NOT NULL;

COMMENT ON TABLE public.commercial_territorial_activities IS
  'Georeferenced commercial field actions (Actividad Comercial Territorial). Not clients.';
COMMENT ON COLUMN public.commercial_territorial_activities.related_opportunity_id IS
  'Optional future link to a Cliente (opportunity). Unused in 1.0.';

CREATE OR REPLACE FUNCTION public.set_commercial_territorial_activities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_territorial_activities_set_updated_at
  ON public.commercial_territorial_activities;
CREATE TRIGGER commercial_territorial_activities_set_updated_at
  BEFORE UPDATE ON public.commercial_territorial_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_territorial_activities_updated_at();

CREATE OR REPLACE FUNCTION public.assign_commercial_territorial_activity_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.code IS NOT NULL AND btrim(NEW.code) <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_territorial_activity_counters (company_id, last_number)
  VALUES (NEW.company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = public.commercial_territorial_activity_counters.last_number + 1
  RETURNING last_number INTO next_num;

  NEW.code := 'ACT-' || lpad(next_num::text, 6, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_territorial_activities_assign_code
  ON public.commercial_territorial_activities;
CREATE TRIGGER commercial_territorial_activities_assign_code
  BEFORE INSERT ON public.commercial_territorial_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_commercial_territorial_activity_code();

ALTER TABLE public.commercial_territorial_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_territorial_activities_select_policy
  ON public.commercial_territorial_activities;
CREATE POLICY commercial_territorial_activities_select_policy
  ON public.commercial_territorial_activities
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

DROP POLICY IF EXISTS commercial_territorial_activities_insert_policy
  ON public.commercial_territorial_activities;
CREATE POLICY commercial_territorial_activities_insert_policy
  ON public.commercial_territorial_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS commercial_territorial_activities_update_policy
  ON public.commercial_territorial_activities;
CREATE POLICY commercial_territorial_activities_update_policy
  ON public.commercial_territorial_activities
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS commercial_territorial_activities_delete_policy
  ON public.commercial_territorial_activities;
CREATE POLICY commercial_territorial_activities_delete_policy
  ON public.commercial_territorial_activities
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commercial_territorial_activities TO authenticated;
GRANT ALL ON TABLE public.commercial_territorial_activities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commercial_territorial_activity_counters TO authenticated;
GRANT ALL ON TABLE public.commercial_territorial_activity_counters TO service_role;
