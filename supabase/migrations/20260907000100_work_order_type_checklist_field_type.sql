-- Sprint 1.0.0A RC2 — Checklist Operativo: tipos de campo

ALTER TABLE public.work_order_type_checklist_items
  ADD COLUMN IF NOT EXISTS field_type text;

UPDATE public.work_order_type_checklist_items
SET field_type = CASE
  WHEN requires_photo THEN 'fotografia'
  ELSE 'confirmacion'
END
WHERE field_type IS NULL;

ALTER TABLE public.work_order_type_checklist_items
  ALTER COLUMN field_type SET NOT NULL;

ALTER TABLE public.work_order_type_checklist_items
  ADD CONSTRAINT work_order_type_checklist_items_field_type_valid
  CHECK (field_type IN ('confirmacion', 'entrada-datos', 'fotografia'));

COMMENT ON COLUMN public.work_order_type_checklist_items.field_type IS
  'Operational checklist field type: confirmacion, entrada-datos, or fotografia.';

ALTER TABLE public.work_order_type_checklist_items
  DROP COLUMN requires_photo;
