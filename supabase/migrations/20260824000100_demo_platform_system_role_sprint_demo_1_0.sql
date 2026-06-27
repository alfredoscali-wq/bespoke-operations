-- Demo Platform 1.0 — rol de sistema demo (solo lectura en UI).

ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'demo';

COMMENT ON TYPE public.system_role IS
  'Application access role: administrador, supervisor, administrativo, operario, demo.';
