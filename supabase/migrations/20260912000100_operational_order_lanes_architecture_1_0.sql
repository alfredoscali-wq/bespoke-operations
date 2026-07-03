-- ARQUITECTURA OPERATIVA 1.0: separate execution_order (planning) from dispatch_order (operations).
-- Assigned OT must not retain execution_order; programmed OT must not retain dispatch_order.

UPDATE public.tasks
SET execution_order = NULL
WHERE status = 'asignada'
  AND execution_order IS NOT NULL
  AND deleted_at IS NULL;

UPDATE public.tasks
SET dispatch_order = NULL
WHERE status = 'programada'
  AND dispatch_order IS NOT NULL
  AND deleted_at IS NULL;
