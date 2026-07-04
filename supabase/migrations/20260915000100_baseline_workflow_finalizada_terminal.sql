-- BASELINE 1.0 — Finalizada es el estado terminal de OT; retirar cerrada del workflow.

-- Retirar transición operativa hacia cerrada (aplicar antes del backfill).
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
    WHEN old_status = 'pendiente' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.is_allowed_task_status_transition(public.task_status, public.task_status) IS
  'Validates operational task status transitions. Finalizada is terminal (BASELINE 1.0).';

-- Corregir sintaxis RAISE del trigger desplegado en C4.1 (sin cambiar la lógica).
CREATE OR REPLACE FUNCTION public.enforce_task_status_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('programada'::public.task_status, 'pendiente'::public.task_status) THEN
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

-- Backfill one-shot: cerrada → finalizada (excluido del workflow operativo).
ALTER TABLE public.tasks DISABLE TRIGGER tasks_enforce_status_workflow;

UPDATE public.tasks
SET
  status = 'finalizada'::public.task_status,
  completed_at = COALESCE(completed_at, closed_at, updated_at, now())
WHERE status = 'cerrada'::public.task_status
  AND deleted_at IS NULL;

ALTER TABLE public.tasks ENABLE TRIGGER tasks_enforce_status_workflow;

-- Timestamps: solo finalizada (cerrada retirada del workflow).
CREATE OR REPLACE FUNCTION public.set_task_completion_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('finalizada', 'pendiente-cierre')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.tasks.closed_at IS
  'Deprecated (BASELINE 1.0). Legacy archive timestamp; no longer set by workflow.';
