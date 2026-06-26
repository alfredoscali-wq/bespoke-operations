-- RC1.3 — Estado oficial Vencida para OT programadas fuera de plazo

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'vencida';

COMMENT ON TYPE public.task_status IS
  'Estados de OT. RC1.3: vencida = programada (asignada) cuya fecha/hora ya pasó sin iniciarse.';
