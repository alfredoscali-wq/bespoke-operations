-- OBRAS OPS 1.0 HOTFIX — Active project task status
--
-- Authoritative rule:
--   INSERT of a task linked to an active Obra (same tenant, not deleted)
--   MUST persist as status = 'asignada', regardless of client-sent status.
--
-- Does NOT modify 20261001000100 (already applied in production).
-- Replaces enforce_task_status_workflow safely via CREATE OR REPLACE.
--
-- Preserves:
--   - project/company/deleted integrity
--   - crew/company/deleted integrity for Obra tasks
--   - OT normal INSERT rules (no project_id → programada/pendiente only)
--   - UPDATE workflow transitions unchanged
--
-- NO ejecutar automáticamente: aplicar manualmente en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.enforce_task_status_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_status public.project_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Crew tenant integrity for Obra tasks.
    IF NEW.project_id IS NOT NULL AND NEW.crew_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.crews c
        WHERE c.id = NEW.crew_id
          AND c.company_id = NEW.company_id
          AND c.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'La cuadrilla no pertenece a la compañía de la tarea o está archivada.';
      END IF;
    END IF;

    -- Obra-linked INSERT: project is source of truth for operational status.
    IF NEW.project_id IS NOT NULL THEN
      SELECT p.status
      INTO v_project_status
      FROM public.projects p
      WHERE p.id = NEW.project_id
        AND p.company_id = NEW.company_id
        AND p.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'La obra no existe, está eliminada o no pertenece al mismo tenant.';
      END IF;

      -- Hotfix: active Obra always forces asignada (ignore client status).
      IF v_project_status = 'active'::public.project_status THEN
        NEW.status := 'asignada'::public.task_status;
        RETURN NEW;
      END IF;

      -- Non-active Obra: cannot insert as asignada.
      IF NEW.status = 'asignada'::public.task_status THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'Solo se pueden crear tareas asignadas en una obra activa del mismo tenant.';
      END IF;

      IF NEW.status NOT IN (
        'programada'::public.task_status,
        'pendiente'::public.task_status
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'Las órdenes de trabajo nuevas deben crearse en estado programada.';
      END IF;

      RETURN NEW;
    END IF;

    -- OT normal (no project_id): unchanged.
    IF NEW.status NOT IN (
      'programada'::public.task_status,
      'pendiente'::public.task_status
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Las órdenes de trabajo nuevas deben crearse en estado programada.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_allowed_task_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Transición de estado no permitida: %s → %s.',
        OLD.status,
        NEW.status
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_task_status_workflow() IS
  'Enforces task status workflow. Obra active INSERT forces asignada from projects.status (OBRAS OPS 1.0 hotfix). Crew/project tenant integrity preserved.';
