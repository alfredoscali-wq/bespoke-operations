-- UX Operativo 1.0: official crew route order frozen at planning confirmation.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS dispatch_order integer;

COMMENT ON COLUMN public.tasks.dispatch_order IS
  'Official operational route position for the crew on due_date (1 = first). Set when planning is confirmed; used for sorting across web, mobile, and reports.';

CREATE UNIQUE INDEX IF NOT EXISTS tasks_dispatch_order_crew_date_unique
  ON public.tasks (due_date, crew_id, dispatch_order)
  WHERE dispatch_order IS NOT NULL
    AND crew_id IS NOT NULL
    AND deleted_at IS NULL;
