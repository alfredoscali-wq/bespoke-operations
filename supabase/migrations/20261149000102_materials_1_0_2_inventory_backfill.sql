-- Materiales 1.0.2 — Backfill stock levels for active materials without inventory row (single depot).

INSERT INTO public.material_stock_levels (
  company_id,
  material_id,
  warehouse_id,
  quantity_available,
  quantity_reserved
)
SELECT
  m.company_id,
  m.id,
  w.id,
  0,
  0
FROM public.materials m
INNER JOIN public.warehouses w
  ON w.company_id = m.company_id
  AND w.active = true
WHERE m.active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.material_stock_levels sl
    WHERE sl.material_id = m.id
      AND sl.company_id = m.company_id
  )
  AND (
    SELECT count(*)::integer
    FROM public.warehouses wh
    WHERE wh.company_id = m.company_id
      AND wh.active = true
  ) = 1
ON CONFLICT (material_id, warehouse_id) DO NOTHING;
