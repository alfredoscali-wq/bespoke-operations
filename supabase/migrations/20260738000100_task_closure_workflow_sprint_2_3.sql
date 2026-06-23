-- SPRINT TAREAS 2.3 — operational closure workflow

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pendiente-cierre';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS rejection_reason text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.tasks.rejection_reason IS
  'Supervisor reason when rejecting a pending closure submission.';

UPDATE public.tasks
SET status = 'pendiente-cierre'
WHERE status = 'en-aprobacion'
  AND deleted_at IS NULL;

UPDATE public.tasks
SET completed_at = COALESCE(completed_at, updated_at)
WHERE status = 'pendiente-cierre'
  AND completed_at IS NULL
  AND deleted_at IS NULL;

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

  IF NEW.status = 'cerrada'
     AND OLD.status IS DISTINCT FROM 'cerrada'
     AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;

  RETURN NEW;
END;
$$;
