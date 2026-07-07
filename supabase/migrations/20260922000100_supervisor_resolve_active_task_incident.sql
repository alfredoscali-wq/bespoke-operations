-- RC3.2.1 — Núcleo definitivo: resolver incidencia activa (continue | reprogram | cancel)
--
-- Decisions:
--   1. Replace RC3.1 gated transition en-curso → asignada with en-curso → programada
--      inside supervisor_resolve_active_task_incident only.
--   2. RC3.1 RPC supervisor_reschedule_active_task_from_incident remains in DB but its
--      specialized transition gate is removed so the broken flow cannot run accidentally.
--   3. Callable only via service_role (admin client).

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
    WHEN old_status = 'programada' AND new_status IN ('asignada', 'vencida', 'cancelada') THEN true
    WHEN old_status = 'asignada' AND new_status IN ('programada', 'en-curso', 'vencida', 'cancelada') THEN true
    WHEN old_status = 'vencida' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    WHEN old_status = 'en-curso' AND new_status IN ('pendiente-cierre', 'incidencia', 'cancelada') THEN true
    WHEN old_status = 'en-curso'
      AND new_status = 'programada'
      AND current_setting('app.supervisor_resolve_active_incident', true) = 'on' THEN true
    WHEN old_status = 'incidencia' AND new_status IN ('en-curso', 'asignada', 'cancelada') THEN true
    WHEN old_status IN ('pendiente-cierre', 'en-aprobacion')
      AND new_status IN ('finalizada', 'en-curso', 'cancelada') THEN true
    WHEN old_status = 'pendiente' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.is_allowed_task_status_transition(public.task_status, public.task_status) IS
  'Validates operational task status transitions. en-curso → programada is allowed only inside supervisor_resolve_active_task_incident (RC3.2.1). RC3.1 en-curso → asignada gate removed.';

CREATE OR REPLACE FUNCTION public.supervisor_resolve_active_task_incident(
  p_company_id uuid,
  p_incident_id uuid,
  p_actor_employee_id uuid,
  p_action text,
  p_comment text,
  p_task_metadata jsonb DEFAULT NULL,
  p_pre_dispatch_clears jsonb DEFAULT NULL,
  p_cancellation_reason text DEFAULT NULL,
  p_cancellation_observation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_incident public.task_incidents%ROWTYPE;
  v_resolved_at timestamptz := now();
  v_action text := lower(trim(COALESCE(p_action, '')));
  v_comment text := trim(COALESCE(p_comment, ''));
BEGIN
  IF p_company_id IS NULL OR p_incident_id IS NULL OR p_actor_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'Parámetros obligatorios incompletos para resolución RC3.2.1.';
  END IF;

  IF v_action NOT IN ('continue', 'reprogram', 'cancel') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'Acción de resolución inválida.';
  END IF;

  IF char_length(v_comment) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'El comentario o motivo es obligatorio.';
  END IF;

  IF char_length(v_comment) > 2000 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'El comentario supera el límite de 2000 caracteres.';
  END IF;

  SELECT *
  INTO v_incident
  FROM public.task_incidents ti
  WHERE ti.id = p_incident_id
    AND ti.company_id = p_company_id
    AND ti.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Incidencia no encontrada.';
  END IF;

  IF v_incident.status NOT IN ('REPORTADA', 'EN_ANALISIS') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'La incidencia no está activa.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks t
  WHERE t.id = v_incident.task_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Orden de trabajo no encontrada.';
  END IF;

  IF v_task.status IS DISTINCT FROM 'en-curso'::public.task_status THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'La resolución RC3.2.1 requiere una OT en estado en-curso.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_actor_employee_id
      AND e.company_id = p_company_id
      AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Empleado actor no encontrado para el tenant.';
  END IF;

  IF v_action = 'continue' THEN
    UPDATE public.task_incidents ti
    SET
      status = 'RESUELTA',
      resolved_by = p_actor_employee_id,
      resolved_at = v_resolved_at,
      updated_at = v_resolved_at
    WHERE ti.id = p_incident_id
      AND ti.company_id = p_company_id
      AND ti.deleted_at IS NULL;

    INSERT INTO public.task_incident_events (
      incident_id,
      event_type,
      comment,
      created_by
    )
    VALUES (
      p_incident_id,
      'CONTINUE',
      v_comment,
      p_actor_employee_id
    );

    INSERT INTO public.task_incident_events (
      incident_id,
      event_type,
      comment,
      created_by
    )
    VALUES (
      p_incident_id,
      'STATUS_CHANGED',
      'Estado actualizado a RESUELTA.',
      p_actor_employee_id
    );

    RETURN jsonb_build_object(
      'task_id', v_task.id,
      'incident_id', p_incident_id,
      'action', v_action,
      'task_status', v_task.status,
      'incident_status', 'RESUELTA',
      'resolved_at', v_resolved_at
    );
  END IF;

  IF v_action = 'reprogram' THEN
    PERFORM public.apply_dispatch_order_updates(p_company_id, p_pre_dispatch_clears);

    PERFORM set_config('app.supervisor_resolve_active_incident', 'on', true);

    UPDATE public.tasks t
    SET
      status = 'programada'::public.task_status,
      crew_id = NULL,
      scheduled_time = NULL,
      execution_order = NULL,
      dispatch_order = NULL,
      task_metadata = COALESCE(p_task_metadata, '{}'::jsonb),
      updated_at = v_resolved_at
    WHERE t.id = v_task.id
      AND t.company_id = p_company_id
      AND t.deleted_at IS NULL;

    UPDATE public.task_incidents ti
    SET
      status = 'RESUELTA',
      resolved_by = p_actor_employee_id,
      resolved_at = v_resolved_at,
      updated_at = v_resolved_at
    WHERE ti.id = p_incident_id
      AND ti.company_id = p_company_id
      AND ti.deleted_at IS NULL;

    INSERT INTO public.task_incident_events (
      incident_id,
      event_type,
      comment,
      created_by
    )
    VALUES (
      p_incident_id,
      'RESCHEDULE',
      v_comment,
      p_actor_employee_id
    );

    INSERT INTO public.task_incident_events (
      incident_id,
      event_type,
      comment,
      created_by
    )
    VALUES (
      p_incident_id,
      'STATUS_CHANGED',
      'Estado actualizado a RESUELTA.',
      p_actor_employee_id
    );

    RETURN jsonb_build_object(
      'task_id', v_task.id,
      'incident_id', p_incident_id,
      'action', v_action,
      'task_status', 'programada',
      'incident_status', 'RESUELTA',
      'resolved_at', v_resolved_at
    );
  END IF;

  -- cancel
  IF char_length(trim(COALESCE(p_cancellation_reason, ''))) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'cancellation_reason es obligatorio para cancelación.';
  END IF;

  PERFORM public.apply_dispatch_order_updates(p_company_id, p_pre_dispatch_clears);

  UPDATE public.tasks t
  SET
    status = 'cancelada'::public.task_status,
    cancellation_reason = trim(p_cancellation_reason),
    cancellation_observation = COALESCE(trim(p_cancellation_observation), ''),
    execution_order = NULL,
    dispatch_order = NULL,
    updated_at = v_resolved_at
  WHERE t.id = v_task.id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL;

  UPDATE public.task_incidents ti
  SET
    status = 'RESUELTA',
    resolved_by = p_actor_employee_id,
    resolved_at = v_resolved_at,
    updated_at = v_resolved_at
  WHERE ti.id = p_incident_id
    AND ti.company_id = p_company_id
    AND ti.deleted_at IS NULL;

  INSERT INTO public.task_incident_events (
    incident_id,
    event_type,
    comment,
    created_by
  )
  VALUES (
    p_incident_id,
    'CANCEL_TASK',
    v_comment,
    p_actor_employee_id
  );

  INSERT INTO public.task_incident_events (
    incident_id,
    event_type,
    comment,
    created_by
  )
  VALUES (
    p_incident_id,
    'STATUS_CHANGED',
    'Estado actualizado a RESUELTA.',
    p_actor_employee_id
  );

  RETURN jsonb_build_object(
    'task_id', v_task.id,
    'incident_id', p_incident_id,
    'action', v_action,
    'task_status', 'cancelada',
    'incident_status', 'RESUELTA',
    'resolved_at', v_resolved_at
  );
END;
$$;

COMMENT ON FUNCTION public.supervisor_resolve_active_task_incident(
  uuid, uuid, uuid, text, text, jsonb, jsonb, text, text
) IS
  'RC3.2.1: atomically resolve an active incident on an en-curso OT via continue, reprogram, or cancel. Callable only via service_role.';

REVOKE ALL ON FUNCTION public.supervisor_resolve_active_task_incident(
  uuid, uuid, uuid, text, text, jsonb, jsonb, text, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.supervisor_resolve_active_task_incident(
  uuid, uuid, uuid, text, text, jsonb, jsonb, text, text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.supervisor_resolve_active_task_incident(
  uuid, uuid, uuid, text, text, jsonb, jsonb, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.supervisor_resolve_active_task_incident(
  uuid, uuid, uuid, text, text, jsonb, jsonb, text, text
) TO service_role;
