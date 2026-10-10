-- Obras — OTs preliminares V1 desde Diseño (Node + NAP).
-- Does not create tasks. Does not enter Planificación until a real OT is confirmed.

CREATE TABLE public.project_design_ot_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  source_element_id uuid NOT NULL REFERENCES public.project_design_elements (id) ON DELETE CASCADE,
  source_element_kind text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  work_type text NOT NULL,
  priority text,
  crew_id uuid REFERENCES public.crews (id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  observations text,
  design_name text,
  design_color text,
  design_icon text,
  design_gain_m numeric(12, 2),
  task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_design_ot_proposals_kind_allowed
    CHECK (source_element_kind IN ('node', 'nap', 'tendido', 'drop', 'otro')),
  CONSTRAINT project_design_ot_proposals_work_type_allowed
    CHECK (work_type IN ('node', 'nap', 'tendido', 'drop', 'otro')),
  CONSTRAINT project_design_ot_proposals_status_allowed
    CHECK (status IN ('draft', 'ready', 'created', 'cancelled')),
  CONSTRAINT project_design_ot_proposals_priority_allowed
    CHECK (priority IS NULL OR priority IN ('alta', 'media', 'baja')),
  CONSTRAINT project_design_ot_proposals_title_not_blank
    CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT project_design_ot_proposals_gain_non_negative
    CHECK (design_gain_m IS NULL OR design_gain_m >= 0),
  CONSTRAINT project_design_ot_proposals_latitude_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT project_design_ot_proposals_longitude_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  CONSTRAINT project_design_ot_proposals_coords_pair
    CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

CREATE INDEX project_design_ot_proposals_company_project_idx
  ON public.project_design_ot_proposals (company_id, project_id);

CREATE INDEX project_design_ot_proposals_source_element_idx
  ON public.project_design_ot_proposals (source_element_id);

CREATE INDEX project_design_ot_proposals_task_idx
  ON public.project_design_ot_proposals (task_id);

CREATE UNIQUE INDEX project_design_ot_proposals_active_source_unique
  ON public.project_design_ot_proposals (company_id, project_id, source_element_id)
  WHERE status <> 'cancelled';

COMMENT ON TABLE public.project_design_ot_proposals IS
  'Draft work-order proposals from project design. Not tasks. Not planning. Node/NAP in V1; table can grow to tendido/drop.';

COMMENT ON COLUMN public.project_design_ot_proposals.work_type IS
  'Intended OT kind from design (node/nap now; tendido/drop later). Not tasks.type.';

COMMENT ON COLUMN public.project_design_ot_proposals.task_id IS
  'Real OT created from this proposal. Snapshot: later design edits do not update the task.';

CREATE OR REPLACE FUNCTION public.set_project_design_ot_proposals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_design_ot_proposal_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project_company uuid;
  v_element_project uuid;
  v_element_kind text;
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
  NEW.title := btrim(NEW.title);
  NEW.observations := NULLIF(btrim(COALESCE(NEW.observations, '')), '');
  NEW.design_name := NULLIF(btrim(COALESCE(NEW.design_name, '')), '');

  SELECT e.project_id, e.kind
  INTO v_element_project, v_element_kind
  FROM public.project_design_elements e
  WHERE e.id = NEW.source_element_id;

  IF v_element_project IS NULL OR v_element_project IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'PROJECT_DESIGN_OT_SOURCE_MISMATCH'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.source_element_kind IS DISTINCT FROM v_element_kind THEN
    RAISE EXCEPTION 'PROJECT_DESIGN_OT_SOURCE_KIND_MISMATCH'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_design_ot_proposals_set_updated_at
  ON public.project_design_ot_proposals;
CREATE TRIGGER project_design_ot_proposals_set_updated_at
  BEFORE UPDATE ON public.project_design_ot_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_design_ot_proposals_updated_at();

DROP TRIGGER IF EXISTS project_design_ot_proposals_enforce_integrity
  ON public.project_design_ot_proposals;
CREATE TRIGGER project_design_ot_proposals_enforce_integrity
  BEFORE INSERT OR UPDATE ON public.project_design_ot_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_design_ot_proposal_integrity();

REVOKE ALL ON FUNCTION public.set_project_design_ot_proposals_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_project_design_ot_proposals_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_project_design_ot_proposal_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_project_design_ot_proposal_integrity() FROM anon;

ALTER TABLE public.project_design_ot_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_design_ot_proposals_select_policy
  ON public.project_design_ot_proposals
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

CREATE POLICY project_design_ot_proposals_insert_policy
  ON public.project_design_ot_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY project_design_ot_proposals_update_policy
  ON public.project_design_ot_proposals
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

CREATE POLICY project_design_ot_proposals_delete_policy
  ON public.project_design_ot_proposals
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_design_ot_proposals TO authenticated;
