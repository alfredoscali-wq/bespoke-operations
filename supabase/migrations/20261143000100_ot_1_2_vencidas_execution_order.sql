-- OT 1.2 — Vencidas release execution_order so they no longer occupy the
-- active planning queue. Does not modify tasks_execution_order_crew_date_unique
-- or 20261142000100_ot_1_1_execution_order_atomic.sql.
-- Does not compact remaining orders. Does not touch dispatch_order, crew, or due_date.

CREATE OR REPLACE FUNCTION public.release_task_execution_order_on_vencida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'vencida' AND OLD.status IS DISTINCT FROM 'vencida' THEN
    NEW.execution_order := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.release_task_execution_order_on_vencida() IS
  'OT 1.2: when status becomes vencida, release execution_order in the same row update. Unique index then matches Planning occupancy. dispatch_order is left unchanged.';

DROP TRIGGER IF EXISTS tasks_release_execution_order_on_vencida ON public.tasks;

CREATE TRIGGER tasks_release_execution_order_on_vencida
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.release_task_execution_order_on_vencida();

-- Existing vencidas that still hold a slot. Identity, crew, date, evidences
-- and status are not modified.
UPDATE public.tasks
SET execution_order = NULL
WHERE status = 'vencida'
  AND execution_order IS NOT NULL
  AND deleted_at IS NULL;
