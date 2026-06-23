-- SPRINT OPERARIO 1.1 — Pasos Operativos básicos

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS operational_steps jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tasks.operational_steps IS
  'Operational steps snapshot for field execution (label, observation, completedAt).';

ALTER TABLE public.task_photos
  ADD COLUMN IF NOT EXISTS operational_step_id uuid NULL;

COMMENT ON COLUMN public.task_photos.operational_step_id IS
  'Links evidence photos (photo_type=evidence) to a task operational step.';

CREATE INDEX IF NOT EXISTS task_photos_task_operational_step_idx
  ON public.task_photos (task_id, operational_step_id)
  WHERE deleted_at IS NULL
    AND photo_type = 'evidence'
    AND operational_step_id IS NOT NULL;
