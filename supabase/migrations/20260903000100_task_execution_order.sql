-- Planning 1.8: suggested daily execution sequence per crew (due_date + crew_id).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS execution_order integer;

COMMENT ON COLUMN public.tasks.execution_order IS
  'Suggested execution sequence for the crew on due_date (1 = first). Scoped per date + crew_id; not global priority or schedule.';

CREATE UNIQUE INDEX IF NOT EXISTS tasks_execution_order_crew_date_unique
  ON public.tasks (due_date, crew_id, execution_order)
  WHERE execution_order IS NOT NULL
    AND crew_id IS NOT NULL
    AND deleted_at IS NULL;
