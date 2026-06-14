-- Bespoke Operations — Sprint 1: field service support on tasks
-- Allows tasks without a linked project (project_id NULL) plus customer/service metadata.
-- Existing obra-linked tasks are unchanged.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS customer_company text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS service_address text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS work_order_number text;

COMMENT ON COLUMN public.tasks.customer_company IS 'Operational customer (e.g. Claro, Movistar).';
COMMENT ON COLUMN public.tasks.customer_name IS 'End customer / subscriber name.';
COMMENT ON COLUMN public.tasks.customer_phone IS 'Contact phone for the field service.';
COMMENT ON COLUMN public.tasks.service_address IS 'Service location address.';
COMMENT ON COLUMN public.tasks.latitude IS 'Optional GPS latitude (structure only; no maps UI yet).';
COMMENT ON COLUMN public.tasks.longitude IS 'Optional GPS longitude (structure only; no maps UI yet).';
COMMENT ON COLUMN public.tasks.work_order_number IS 'External work order / ticket number.';

CREATE INDEX IF NOT EXISTS tasks_work_order_number_idx
  ON public.tasks (work_order_number)
  WHERE work_order_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_field_service_idx
  ON public.tasks (project_id)
  WHERE project_id IS NULL AND deleted_at IS NULL;

COMMENT ON TABLE public.tasks IS 'Field activities linked to infrastructure projects or standalone field services.';
