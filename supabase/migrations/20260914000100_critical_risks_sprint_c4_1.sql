-- Sprint C4.1 — Critical security: satellite-table RLS + task workflow enforcement.

-- ---------------------------------------------------------------------------
-- Helper: crew_members tenant scope via parent crew
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crew_member_belongs_to_user_company(p_crew_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crews c
    WHERE c.id = p_crew_id
      AND c.deleted_at IS NULL
      AND c.company_id = public.auth_user_company_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- FASE 1 — Multi-tenant RLS
-- ---------------------------------------------------------------------------

-- crew_members (no company_id column — scope via crews)
DROP POLICY IF EXISTS crew_members_select_policy ON public.crew_members;
CREATE POLICY crew_members_select_policy
  ON public.crew_members
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.crew_member_belongs_to_user_company(crew_id)
  );

DROP POLICY IF EXISTS crew_members_insert_policy ON public.crew_members;
CREATE POLICY crew_members_insert_policy
  ON public.crew_members
  FOR INSERT
  WITH CHECK (
    public.crew_member_belongs_to_user_company(crew_id)
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS crew_members_update_policy ON public.crew_members;
CREATE POLICY crew_members_update_policy
  ON public.crew_members
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.crew_member_belongs_to_user_company(crew_id)
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    public.crew_member_belongs_to_user_company(crew_id)
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- project_history
DROP POLICY IF EXISTS project_history_select_policy ON public.project_history;
CREATE POLICY project_history_select_policy
  ON public.project_history
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS project_history_insert_policy ON public.project_history;
CREATE POLICY project_history_insert_policy
  ON public.project_history
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- employee_availability
DROP POLICY IF EXISTS employee_availability_select_policy ON public.employee_availability;
CREATE POLICY employee_availability_select_policy
  ON public.employee_availability
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS employee_availability_insert_policy ON public.employee_availability;
CREATE POLICY employee_availability_insert_policy
  ON public.employee_availability
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS employee_availability_update_policy ON public.employee_availability;
CREATE POLICY employee_availability_update_policy
  ON public.employee_availability
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS employee_availability_delete_policy ON public.employee_availability;
CREATE POLICY employee_availability_delete_policy
  ON public.employee_availability
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- task_photos
DROP POLICY IF EXISTS task_photos_select_policy ON public.task_photos;
CREATE POLICY task_photos_select_policy
  ON public.task_photos
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS task_photos_insert_policy ON public.task_photos;
CREATE POLICY task_photos_insert_policy
  ON public.task_photos
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS task_photos_update_policy ON public.task_photos;
CREATE POLICY task_photos_update_policy
  ON public.task_photos
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- task-photos storage bucket (tenant scope via tasks / task_photos)
DROP POLICY IF EXISTS task_photos_storage_select ON storage.objects;
CREATE POLICY task_photos_storage_select
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'task-photos'
    AND (
      EXISTS (
        SELECT 1
        FROM public.task_photos tp
        WHERE tp.storage_path = name
          AND tp.deleted_at IS NULL
          AND tp.company_id = public.auth_user_company_id()
      )
      OR EXISTS (
        SELECT 1
        FROM public.tasks t
        WHERE t.id::text = split_part(name, '/', 1)
          AND t.deleted_at IS NULL
          AND t.company_id = public.auth_user_company_id()
      )
    )
  );

DROP POLICY IF EXISTS task_photos_storage_insert ON storage.objects;
CREATE POLICY task_photos_storage_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'task-photos'
    AND NOT public.auth_is_demo_platform_read_only()
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id::text = split_part(name, '/', 1)
        AND t.deleted_at IS NULL
        AND t.company_id = public.auth_user_company_id()
    )
  );

DROP POLICY IF EXISTS task_photos_storage_update ON storage.objects;
CREATE POLICY task_photos_storage_update
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'task-photos'
    AND NOT public.auth_is_demo_platform_read_only()
    AND EXISTS (
      SELECT 1
      FROM public.task_photos tp
      WHERE tp.storage_path = name
        AND tp.deleted_at IS NULL
        AND tp.company_id = public.auth_user_company_id()
    )
  )
  WITH CHECK (
    bucket_id = 'task-photos'
    AND NOT public.auth_is_demo_platform_read_only()
    AND EXISTS (
      SELECT 1
      FROM public.task_photos tp
      WHERE tp.storage_path = name
        AND tp.company_id = public.auth_user_company_id()
    )
  );

DROP POLICY IF EXISTS task_photos_storage_delete ON storage.objects;
CREATE POLICY task_photos_storage_delete
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'task-photos'
    AND NOT public.auth_is_demo_platform_read_only()
    AND EXISTS (
      SELECT 1
      FROM public.task_photos tp
      WHERE tp.storage_path = name
        AND tp.deleted_at IS NULL
        AND tp.company_id = public.auth_user_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- FASE 2 — Task workflow enforcement (mirrors lib/tasks/task-status-workflow.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_allowed_task_status_transition(
  old_status public.task_status,
  new_status public.task_status
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN old_status IS NOT DISTINCT FROM new_status THEN true
    WHEN old_status = 'programada' AND new_status IN ('asignada', 'vencida', 'cancelada') THEN true
    WHEN old_status = 'asignada' AND new_status IN ('programada', 'en-curso', 'vencida', 'cancelada') THEN true
    WHEN old_status = 'vencida' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    WHEN old_status = 'en-curso' AND new_status IN ('pendiente-cierre', 'incidencia', 'cancelada') THEN true
    WHEN old_status = 'incidencia' AND new_status IN ('en-curso', 'asignada', 'cancelada') THEN true
    WHEN old_status IN ('pendiente-cierre', 'en-aprobacion')
      AND new_status IN ('finalizada', 'en-curso', 'cancelada') THEN true
    WHEN old_status = 'finalizada' AND new_status IN ('cerrada', 'cancelada') THEN true
    WHEN old_status = 'pendiente' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.is_allowed_task_status_transition(public.task_status, public.task_status) IS
  'Validates operational task status transitions enforced at database level (Sprint C4.1).';

CREATE OR REPLACE FUNCTION public.enforce_task_status_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('programada'::public.task_status, 'pendiente'::public.task_status) THEN
      RAISE EXCEPTION 'TASK_STATUS_INVALID_INSERT'
        USING ERRCODE = 'check_violation',
              MESSAGE = 'Las órdenes de trabajo nuevas deben crearse en estado programada.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_allowed_task_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'TASK_STATUS_TRANSITION_FORBIDDEN'
      USING ERRCODE = 'check_violation',
        MESSAGE = format(
          'Transición de estado no permitida: %s → %s.',
          OLD.status,
          NEW.status
        );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_enforce_status_workflow ON public.tasks;

CREATE TRIGGER tasks_enforce_status_workflow
  BEFORE INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_status_workflow();

-- ---------------------------------------------------------------------------
-- FASE 3 — Planificación (diferido)
-- confirmPlanningTasks / replanificar persisten cambios secuencialmente vía
-- múltiples PATCH desde el cliente. Atomicidad requiere RPC transaccional
-- (confirm_planning_batch) que no se implementa en C4.1 para no alterar APIs
-- ni la arquitectura de Planificación Dinámica. Riesgo PL-4: medio, diferido.
-- ---------------------------------------------------------------------------
