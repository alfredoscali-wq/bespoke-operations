-- Obras — Diseño de Obra V1.3: ganancias de cable (reserva, no geometría).
-- planned_length_m on segments remains physical length only.

ALTER TABLE public.project_design_elements
  ADD COLUMN IF NOT EXISTS gain_m numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.project_design_elements
  DROP CONSTRAINT IF EXISTS project_design_elements_gain_non_negative;

ALTER TABLE public.project_design_elements
  ADD CONSTRAINT project_design_elements_gain_non_negative
    CHECK (gain_m >= 0);

COMMENT ON COLUMN public.project_design_elements.gain_m IS
  'Extra planned cable meters at this node/NAP. Does not change geometry. Default 0.';

CREATE TABLE public.project_design_gains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  segment_id uuid NOT NULL REFERENCES public.project_design_segments (id) ON DELETE CASCADE,
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  gain_m numeric(12, 2) NOT NULL,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_design_gains_gain_non_negative
    CHECK (gain_m >= 0),
  CONSTRAINT project_design_gains_latitude_range
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT project_design_gains_longitude_range
    CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX project_design_gains_company_project_idx
  ON public.project_design_gains (company_id, project_id);

CREATE INDEX project_design_gains_segment_idx
  ON public.project_design_gains (segment_id);

COMMENT ON TABLE public.project_design_gains IS
  'Planned cable reserve points snapped onto a segment. Not geometry. Not a new polyline.';

COMMENT ON COLUMN public.project_design_gains.gain_m IS
  'Extra planned cable meters at this point. Added to total cable; does not change planned_length_m.';

COMMENT ON COLUMN public.project_design_gains.segment_id IS
  'Owning trace. CASCADE deletes the gain when the segment is removed.';

CREATE OR REPLACE FUNCTION public.set_project_design_gains_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_design_gain_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project_company uuid;
  v_segment_project uuid;
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

  SELECT s.project_id
  INTO v_segment_project
  FROM public.project_design_segments s
  WHERE s.id = NEW.segment_id;

  IF v_segment_project IS NULL OR v_segment_project IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'PROJECT_DESIGN_GAIN_SEGMENT_MISMATCH'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.observations := NULLIF(btrim(COALESCE(NEW.observations, '')), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_design_gains_set_updated_at ON public.project_design_gains;
CREATE TRIGGER project_design_gains_set_updated_at
  BEFORE UPDATE ON public.project_design_gains
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_design_gains_updated_at();

DROP TRIGGER IF EXISTS project_design_gains_enforce_integrity ON public.project_design_gains;
CREATE TRIGGER project_design_gains_enforce_integrity
  BEFORE INSERT OR UPDATE ON public.project_design_gains
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_design_gain_integrity();

REVOKE ALL ON FUNCTION public.set_project_design_gains_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_project_design_gains_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_project_design_gain_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_project_design_gain_integrity() FROM anon;

ALTER TABLE public.project_design_gains ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_design_gains_select_policy
  ON public.project_design_gains
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

CREATE POLICY project_design_gains_insert_policy
  ON public.project_design_gains
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY project_design_gains_update_policy
  ON public.project_design_gains
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

CREATE POLICY project_design_gains_delete_policy
  ON public.project_design_gains
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_design_gains TO authenticated;
