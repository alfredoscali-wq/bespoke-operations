-- OPERACIONES 2.1 — incident reporting and supervisor resolution

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'incidencia';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS incident_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS incident_observation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS incident_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS incident_reported_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_observation text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.tasks.incident_reason IS
  'Structured reason code when operario reports an incident.';
COMMENT ON COLUMN public.tasks.incident_observation IS
  'Operario free-text description for the reported incident.';
COMMENT ON COLUMN public.tasks.incident_reported_at IS
  'Timestamp when the operario reported the incident.';
COMMENT ON COLUMN public.tasks.incident_reported_by IS
  'Display name of the operario who reported the incident.';
COMMENT ON COLUMN public.tasks.cancellation_reason IS
  'Structured reason when supervisor cancels an OT.';
COMMENT ON COLUMN public.tasks.cancellation_observation IS
  'Supervisor observation when cancelling an OT.';
