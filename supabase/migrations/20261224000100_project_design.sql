-- Obras — Diseño de Obra V1 (planificado): nodo, NAP y tramos manuales.
-- Independent of network_sites / network_devices / tasks execution.
-- Geometry is jsonb [{latitude, longitude}, ...] — no PostGIS in this phase.

CREATE TABLE public.project_design_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('node', 'nap')),
  name text NOT NULL,
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  notes text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_design_elements_name_not_blank
    CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT project_design_elements_latitude_range
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT project_design_elements_longitude_range
    CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX project_design_elements_company_project_idx
  ON public.project_design_elements (company_id, project_id);

CREATE INDEX project_design_elements_project_kind_idx
  ON public.project_design_elements (project_id, kind, display_order);

COMMENT ON TABLE public.project_design_elements IS
  'Planned design elements (node / NAP) for a project. Not executed infrastructure and not network_sites.';

COMMENT ON COLUMN public.project_design_elements.kind IS
  'Planned element kind: node or nap. Independent of tasks.type and network_sites.kind.';

CREATE TABLE public.project_design_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  origin_element_id uuid REFERENCES public.project_design_elements (id) ON DELETE SET NULL,
  destination_element_id uuid REFERENCES public.project_design_elements (id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  geometry jsonb NOT NULL,
  planned_length_m numeric(12, 2) NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_design_segments_length_non_negative
    CHECK (planned_length_m >= 0),
  CONSTRAINT project_design_segments_geometry_is_array
    CHECK (jsonb_typeof(geometry) = 'array')
);

CREATE INDEX project_design_segments_company_project_idx
  ON public.project_design_segments (company_id, project_id);

CREATE INDEX project_design_segments_origin_idx
  ON public.project_design_segments (origin_element_id);

CREATE INDEX project_design_segments_destination_idx
  ON public.project_design_segments (destination_element_id);

COMMENT ON TABLE public.project_design_segments IS
  'Planned fiber segments drawn by hand. Geometry is the exact user vertices. Length is planned meters only.';

COMMENT ON COLUMN public.project_design_segments.geometry IS
  'JSON array of {latitude, longitude} in draw order. Not GeoJSON. Not street-snapped.';

COMMENT ON COLUMN public.project_design_segments.planned_length_m IS
  'Great-circle length of geometry in meters (WGS84). Planned, not executed.';

COMMENT ON COLUMN public.project_design_segments.origin_element_id IS
  'Optional planned origin element. SET NULL if the element is deleted; geometry is kept.';

COMMENT ON COLUMN public.project_design_segments.destination_element_id IS
  'Optional planned destination element. SET NULL if the element is deleted; geometry is kept.';

-- ---------------------------------------------------------------------------
-- Distance + geometry helpers (no PostGIS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gps_haversine_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371000 * 2 * atan2(sqrt(a), sqrt(GREATEST(0, 1 - a)))
  FROM (
    SELECT
      sin(radians(lat2 - lat1) / 2) ^ 2
      + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(radians(lon2 - lon1) / 2) ^ 2 AS a
  ) s;
$$;

COMMENT ON FUNCTION public.gps_haversine_meters(double precision, double precision, double precision, double precision) IS
  'Great-circle distance in meters (WGS84, R=6371000). Shared by planned design lengths.';

REVOKE ALL ON FUNCTION public.gps_haversine_meters(double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gps_haversine_meters(double precision, double precision, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.gps_haversine_meters(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gps_haversine_meters(double precision, double precision, double precision, double precision) TO service_role;

CREATE OR REPLACE FUNCTION public.project_design_geometry_length_m(p_geometry jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_total double precision := 0;
  v_count integer;
  v_i integer;
  v_lat1 double precision;
  v_lon1 double precision;
  v_lat2 double precision;
  v_lon2 double precision;
BEGIN
  IF p_geometry IS NULL OR jsonb_typeof(p_geometry) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'PROJECT_DESIGN_GEOMETRY_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;

  v_count := jsonb_array_length(p_geometry);
  IF v_count < 2 THEN
    RAISE EXCEPTION 'PROJECT_DESIGN_GEOMETRY_TOO_SHORT'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_i IN 0 .. v_count - 2 LOOP
    v_lat1 := (p_geometry -> v_i ->> 'latitude')::double precision;
    v_lon1 := (p_geometry -> v_i ->> 'longitude')::double precision;
    v_lat2 := (p_geometry -> (v_i + 1) ->> 'latitude')::double precision;
    v_lon2 := (p_geometry -> (v_i + 1) ->> 'longitude')::double precision;

    IF v_lat1 IS NULL OR v_lon1 IS NULL OR v_lat2 IS NULL OR v_lon2 IS NULL THEN
      RAISE EXCEPTION 'PROJECT_DESIGN_GEOMETRY_INVALID'
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_lat1 < -90 OR v_lat1 > 90 OR v_lat2 < -90 OR v_lat2 > 90
      OR v_lon1 < -180 OR v_lon1 > 180 OR v_lon2 < -180 OR v_lon2 > 180 THEN
      RAISE EXCEPTION 'PROJECT_DESIGN_GEOMETRY_OUT_OF_RANGE'
        USING ERRCODE = 'check_violation';
    END IF;

    v_total := v_total + public.gps_haversine_meters(v_lat1, v_lon1, v_lat2, v_lon2);
  END LOOP;

  RETURN round(v_total::numeric, 2);
END;
$$;

COMMENT ON FUNCTION public.project_design_geometry_length_m(jsonb) IS
  'Sums great-circle meters of a planned polyline stored as [{latitude, longitude}, ...].';

REVOKE ALL ON FUNCTION public.project_design_geometry_length_m(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_design_geometry_length_m(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.project_design_geometry_length_m(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_design_geometry_length_m(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.set_project_design_elements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_design_segments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_design_element_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project_company uuid;
BEGIN
  SELECT p.company_id
  INTO v_project_company
  FROM public.projects p
  WHERE p.id = NEW.project_id
    AND p.deleted_at IS NULL;

  IF v_project_company IS NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.company_id := v_project_company;
  NEW.name := btrim(NEW.name);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_design_segment_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project_company uuid;
  v_origin_project uuid;
  v_destination_project uuid;
BEGIN
  SELECT p.company_id
  INTO v_project_company
  FROM public.projects p
  WHERE p.id = NEW.project_id
    AND p.deleted_at IS NULL;

  IF v_project_company IS NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.company_id := v_project_company;

  IF NEW.origin_element_id IS NOT NULL THEN
    SELECT e.project_id
    INTO v_origin_project
    FROM public.project_design_elements e
    WHERE e.id = NEW.origin_element_id;

    IF v_origin_project IS NULL OR v_origin_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'PROJECT_DESIGN_ORIGIN_MISMATCH'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  IF NEW.destination_element_id IS NOT NULL THEN
    SELECT e.project_id
    INTO v_destination_project
    FROM public.project_design_elements e
    WHERE e.id = NEW.destination_element_id;

    IF v_destination_project IS NULL OR v_destination_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'PROJECT_DESIGN_DESTINATION_MISMATCH'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  NEW.planned_length_m := public.project_design_geometry_length_m(NEW.geometry);
  NEW.name := COALESCE(btrim(NEW.name), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_design_elements_set_updated_at ON public.project_design_elements;
CREATE TRIGGER project_design_elements_set_updated_at
  BEFORE UPDATE ON public.project_design_elements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_design_elements_updated_at();

DROP TRIGGER IF EXISTS project_design_elements_enforce_company ON public.project_design_elements;
CREATE TRIGGER project_design_elements_enforce_company
  BEFORE INSERT OR UPDATE ON public.project_design_elements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_design_element_company();

DROP TRIGGER IF EXISTS project_design_segments_set_updated_at ON public.project_design_segments;
CREATE TRIGGER project_design_segments_set_updated_at
  BEFORE UPDATE ON public.project_design_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_design_segments_updated_at();

DROP TRIGGER IF EXISTS project_design_segments_enforce_integrity ON public.project_design_segments;
CREATE TRIGGER project_design_segments_enforce_integrity
  BEFORE INSERT OR UPDATE ON public.project_design_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_design_segment_integrity();

REVOKE ALL ON FUNCTION public.set_project_design_elements_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_project_design_elements_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_project_design_segments_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_project_design_segments_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_project_design_element_company() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_project_design_element_company() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_project_design_segment_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_project_design_segment_integrity() FROM anon;

-- ---------------------------------------------------------------------------
-- RLS — same tenant + demo guard as projects (module gate is /obras UI)
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_design_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_design_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_design_elements_select_policy
  ON public.project_design_elements
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

CREATE POLICY project_design_elements_insert_policy
  ON public.project_design_elements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY project_design_elements_update_policy
  ON public.project_design_elements
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY project_design_elements_delete_policy
  ON public.project_design_elements
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY project_design_segments_select_policy
  ON public.project_design_segments
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

CREATE POLICY project_design_segments_insert_policy
  ON public.project_design_segments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY project_design_segments_update_policy
  ON public.project_design_segments
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY project_design_segments_delete_policy
  ON public.project_design_segments
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_design_elements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_design_segments TO authenticated;
