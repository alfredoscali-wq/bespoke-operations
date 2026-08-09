-- OBRAS OPS 2.4 — permitir incidencia → programada (resolver OT de Obra).
-- No altera el flujo operativo RC3.1 (task_incidents / replanificar).

CREATE OR REPLACE FUNCTION public.is_allowed_task_status_transition(
  old_status public.task_status,
  new_status public.task_status
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN old_status IS NOT DISTINCT FROM new_status THEN true
    WHEN old_status = 'borrador' AND new_status IN ('programada', 'cancelada') THEN true
    WHEN old_status = 'programada' AND new_status IN ('asignada', 'vencida', 'cancelada') THEN true
    WHEN old_status = 'asignada' AND new_status IN ('programada', 'en-curso', 'vencida', 'cancelada') THEN true
    WHEN old_status = 'vencida' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    WHEN old_status = 'en-curso' AND new_status IN ('pendiente-cierre', 'incidencia', 'cancelada') THEN true
    WHEN old_status = 'en-curso'
      AND new_status = 'programada'
      AND current_setting('app.supervisor_resolve_active_incident', true) = 'on' THEN true
    WHEN old_status = 'incidencia'
      AND new_status IN ('en-curso', 'asignada', 'programada', 'cancelada') THEN true
    WHEN old_status IN ('pendiente-cierre', 'en-aprobacion')
      AND new_status IN ('finalizada', 'en-curso', 'cancelada') THEN true
    WHEN old_status = 'pendiente' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.is_allowed_task_status_transition(public.task_status, public.task_status) IS
  'Validates operational task status transitions. OPS 2.4: incidencia → programada (Obra resolve).';
