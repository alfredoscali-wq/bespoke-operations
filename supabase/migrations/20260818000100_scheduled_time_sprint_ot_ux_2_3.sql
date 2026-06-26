-- SPRINT OT UX 2.3 — Hora programada de OT

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scheduled_time time NULL;

COMMENT ON COLUMN public.tasks.scheduled_time IS
  'Optional scheduled time for work order operational ordering within the day.';
