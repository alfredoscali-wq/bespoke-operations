-- SPRINT OT 2.1 — Importe a cobrar

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS amount_to_collect numeric(10, 2) NULL;

COMMENT ON COLUMN public.tasks.amount_to_collect IS
  'Optional amount to collect from the customer during OT execution.';
