-- Sprint v1.0.x — Checklist operativo por Tipo de OT + Tecnología.
-- Extiende work_order_type_checklist_items con technology (fiber | wireless | todas).
-- Filas existentes quedan como "todas" (fallback) para mantener compatibilidad.

ALTER TABLE public.work_order_type_checklist_items
  ADD COLUMN IF NOT EXISTS technology text;

UPDATE public.work_order_type_checklist_items
SET technology = 'todas'
WHERE technology IS NULL
   OR btrim(technology) = '';

ALTER TABLE public.work_order_type_checklist_items
  ALTER COLUMN technology SET DEFAULT 'todas';

ALTER TABLE public.work_order_type_checklist_items
  ALTER COLUMN technology SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_order_type_checklist_items_technology_check'
      AND conrelid = 'public.work_order_type_checklist_items'::regclass
  ) THEN
    ALTER TABLE public.work_order_type_checklist_items
      ADD CONSTRAINT work_order_type_checklist_items_technology_check
      CHECK (technology IN ('fiber', 'wireless', 'todas'));
  END IF;
END
$$;

DROP INDEX IF EXISTS public.work_order_type_checklist_items_order_unique;

CREATE UNIQUE INDEX IF NOT EXISTS work_order_type_checklist_items_order_unique
  ON public.work_order_type_checklist_items (
    company_id,
    service_type,
    technology,
    sort_order
  );

DROP INDEX IF EXISTS public.work_order_type_checklist_items_lookup_idx;

CREATE INDEX IF NOT EXISTS work_order_type_checklist_items_lookup_idx
  ON public.work_order_type_checklist_items (
    company_id,
    service_type,
    technology,
    sort_order
  );

COMMENT ON COLUMN public.work_order_type_checklist_items.technology IS
  'Checklist technology scope: fiber, wireless, or todas (fallback when no specific match).';
