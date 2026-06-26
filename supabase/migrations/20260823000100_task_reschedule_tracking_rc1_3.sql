-- RC1.3 — Trazabilidad de reprogramación de OT (planificación original + auditoría)

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS original_scheduled_date date,
  ADD COLUMN IF NOT EXISTS original_scheduled_time time,
  ADD COLUMN IF NOT EXISTS rescheduled_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reschedule_notes text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.tasks.original_scheduled_date IS
  'Fecha programada original antes de la primera reprogramación. No se sobrescribe.';

COMMENT ON COLUMN public.tasks.original_scheduled_time IS
  'Hora programada original antes de la primera reprogramación. No se sobrescribe.';

COMMENT ON COLUMN public.tasks.rescheduled_by IS
  'Usuario que ejecutó la última reprogramación.';

COMMENT ON COLUMN public.tasks.rescheduled_at IS
  'Timestamp de la última reprogramación.';

COMMENT ON COLUMN public.tasks.reschedule_reason IS
  'Código de motivo de la última reprogramación.';

COMMENT ON COLUMN public.tasks.reschedule_notes IS
  'Observación libre asociada a la última reprogramación.';
