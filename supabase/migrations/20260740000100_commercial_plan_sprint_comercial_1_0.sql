-- SPRINT COMERCIAL 1.0 — Plan contratado y costo de instalación

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contracted_plan text NULL,
  ADD COLUMN IF NOT EXISTS installation_cost numeric NULL;

COMMENT ON COLUMN public.tasks.contracted_plan IS
  'Contracted service plan code for new installation OTs (50Mb, 100Mb, 300Mb, 20Mb).';

COMMENT ON COLUMN public.tasks.installation_cost IS
  'Installation cost in local currency for new installation OTs.';
