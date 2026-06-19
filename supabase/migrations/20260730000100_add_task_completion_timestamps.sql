-- Task completion timestamps for crew compliance metrics.
-- Set automatically via trigger; never overwritten once populated.

ALTER TABLE public.tasks
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN closed_at timestamptz;

COMMENT ON COLUMN public.tasks.completed_at IS
  'First transition to finalizada. Set by trigger; immutable after populated.';
COMMENT ON COLUMN public.tasks.closed_at IS
  'First transition to cerrada. Set by trigger; immutable after populated.';

CREATE INDEX tasks_completed_at_idx
  ON public.tasks (completed_at)
  WHERE deleted_at IS NULL AND completed_at IS NOT NULL;

CREATE INDEX tasks_closed_at_idx
  ON public.tasks (closed_at)
  WHERE deleted_at IS NULL AND closed_at IS NOT NULL;

CREATE INDEX tasks_crew_completed_at_idx
  ON public.tasks (crew_id, completed_at)
  WHERE deleted_at IS NULL AND completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_task_completion_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'finalizada'
     AND OLD.status IS DISTINCT FROM 'finalizada'
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

CREATE TRIGGER tasks_set_completion_timestamps
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_completion_timestamps();

-- Approximate backfill for existing completed/closed tasks (uses updated_at as proxy).
UPDATE public.tasks
SET completed_at = updated_at
WHERE completed_at IS NULL
  AND status IN ('finalizada', 'cerrada')
  AND deleted_at IS NULL;

UPDATE public.tasks
SET closed_at = updated_at
WHERE closed_at IS NULL
  AND status = 'cerrada'
  AND deleted_at IS NULL;
