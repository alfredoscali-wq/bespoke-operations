-- Work order fields for operational task creation (Sprint TAREAS UX 3).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS locality text,
  ADD COLUMN IF NOT EXISTS task_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tasks.service_type IS
  'Operational work order type (instalacion-nueva, service-tecnico, etc.). Distinct from task_type enum.';

COMMENT ON COLUMN public.tasks.locality IS
  'Primary locality for field service / work orders.';

COMMENT ON COLUMN public.tasks.task_metadata IS
  'Type-specific work order fields (addresses, motives, equipment, etc.).';

CREATE INDEX IF NOT EXISTS tasks_service_type_idx
  ON public.tasks (service_type)
  WHERE deleted_at IS NULL AND service_type IS NOT NULL;
