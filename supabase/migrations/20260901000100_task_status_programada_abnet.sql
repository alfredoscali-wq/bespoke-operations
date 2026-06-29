-- ABNet: estado inicial de OT renombrado de pendiente a programada.
-- "Pendiente" queda reservado para pendiente-cierre (validación administrativa).

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'programada';

UPDATE public.tasks
SET status = 'programada'
WHERE status = 'pendiente';

ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'programada';

COMMENT ON TYPE public.task_status IS
  'Estados operativos de OT. programada = creada por ventas/atención, sin planificación del supervisor publicada.';
