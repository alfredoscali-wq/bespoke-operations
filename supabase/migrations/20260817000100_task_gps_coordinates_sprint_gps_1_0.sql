-- SPRINT GPS 1.0 — Coordenadas de ubicación de OT

ALTER TABLE public.tasks
  ALTER COLUMN latitude TYPE numeric(10, 7),
  ALTER COLUMN longitude TYPE numeric(10, 7);

COMMENT ON COLUMN public.tasks.latitude IS
  'GPS latitude for work order location (map picker). Sprint GPS 1.0.';

COMMENT ON COLUMN public.tasks.longitude IS
  'GPS longitude for work order location (map picker). Sprint GPS 1.0.';
