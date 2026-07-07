-- RC3.1 — Replanificar OT en-curso desde incidencia activa (Opción D)
--
-- Mechanism:
--   1. Context-gated transition en-curso → asignada via SET LOCAL app.supervisor_reschedule_active_incident = 'on'
--   2. Transactional RPC supervisor_reschedule_active_task_from_incident (SECURITY DEFINER)
--   3. REVOKE PUBLIC; GRANT EXECUTE only to service_role (server-side admin client)
--
-- PATCH/RLS cannot invoke the RPC without service_role. Generic client PATCH still hits
-- enforce_task_status_workflow without the context flag and is rejected.

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
      AND new_status = 'asignada'
      AND current_setting('app.supervisor_reschedule_active_incident', true) = 'on' THEN true
    WHEN old_status = 'incidencia' AND new_status IN ('en-curso', 'asignada', 'cancelada') THEN true
    WHEN old_status IN ('pendiente-cierre', 'en-aprobacion')
      AND new_status IN ('finalizada', 'en-curso', 'cancelada') THEN true
    WHEN old_status = 'pendiente' AND new_status IN ('programada', 'asignada', 'cancelada') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.is_allowed_task_status_transition(public.task_status, public.task_status) IS
  'Validates operational task status transitions. en-curso → asignada is allowed only inside supervisor_reschedule_active_task_from_incident (RC3.1).';

CREATE OR REPLACE FUNCTION public.apply_dispatch_order_updates(
  p_company_id uuid,
  p_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_task_id uuid;
  v_dispatch_order integer;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_updates)
  LOOP
    v_task_id := NULLIF(v_item ->> 'task_id', '')::uuid;
    IF v_task_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'invalid_parameter_value',
        MESSAGE = 'Actualización de dispatch_order inválida: task_id requerido.';
    END IF;

    IF v_item ? 'dispatch_order' AND v_item -> 'dispatch_order' IS NULL THEN
      v_dispatch_order := NULL;
    ELSE
      v_dispatch_order := (v_item ->> 'dispatch_order')::integer;
    END IF;

    UPDATE public.tasks t
    SET dispatch_order = v_dispatch_order
    WHERE t.id = v_task_id
      AND t.company_id = p_company_id
      AND t.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'foreign_key_violation',
        MESSAGE = format('Orden de trabajo no encontrada para dispatch_order: %s.', v_task_id);
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.apply_dispatch_order_updates(uuid, jsonb) IS
  'Internal helper: applies dispatch_order updates for a tenant inside supervisor_reschedule_active_task_from_incident.';

REVOKE ALL ON FUNCTION public.apply_dispatch_order_updates(uuid, jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.supervisor_reschedule_active_task_from_incident(
  p_company_id uuid,
  p_incident_id uuid,
  p_task_id uuid,
  p_actor_employee_id uuid,
  p_due_date date,
  p_scheduled_time text,
  p_crew_id uuid,
  p_crew text,
  p_supervisor text,
  p_rescheduled_by text,
  p_reschedule_reason text,
  p_reschedule_notes text,
  p_task_metadata jsonb,
  p_original_scheduled_date date,
  p_original_scheduled_time text,
  p_pre_dispatch_clears jsonb,
  p_post_dispatch_assignments jsonb,
  p_incident_event_comment text
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
BEGIN
  IF p_company_id IS NULL OR p_incident_id IS NULL OR p_task_id IS NULL OR p_actor_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'Parámetros obligatorios incompletos para replanificación RC3.1.';
  END IF;

  IF char_length(trim(COALESCE(p_rescheduled_by, ''))) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'rescheduled_by es obligatorio.';
  END IF;

  IF char_length(trim(COALESCE(p_reschedule_reason, ''))) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'reschedule_reason es obligatorio.';
  END IF;

  IF p_due_date IS NULL OR char_length(trim(COALESCE(p_scheduled_time, ''))) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'due_date y scheduled_time son obligatorios.';
  END IF;

  IF p_crew_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'crew_id es obligatorio para replanificación RC3.1.';
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

  IF v_incident.task_id IS DISTINCT FROM p_task_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'La incidencia no pertenece a la orden de trabajo indicada.';
  END IF;

  IF v_incident.status NOT IN ('REPORTADA', 'EN_ANALISIS') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'La incidencia no está activa.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks t
  WHERE t.id = p_task_id
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
      MESSAGE = 'La replanificación RC3.1 requiere una OT en estado en-curso.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crews c
    WHERE c.id = p_crew_id
      AND c.company_id = p_company_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Cuadrilla no encontrada para el tenant.';
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

  PERFORM public.apply_dispatch_order_updates(p_company_id, p_pre_dispatch_clears);

  PERFORM set_config('app.supervisor_reschedule_active_incident', 'on', true);

  UPDATE public.tasks t
  SET
    status = 'asignada'::public.task_status,
    due_date = p_due_date,
    start_date = p_due_date,
    scheduled_time = trim(p_scheduled_time),
    crew_id = p_crew_id,
    crew = COALESCE(trim(p_crew), ''),
    supervisor = COALESCE(trim(p_supervisor), ''),
    execution_order = NULL,
    dispatch_order = NULL,
    rescheduled_by = trim(p_rescheduled_by),
    rescheduled_at = v_resolved_at,
    reschedule_reason = trim(p_reschedule_reason),
    reschedule_notes = COALESCE(trim(p_reschedule_notes), ''),
    task_metadata = COALESCE(p_task_metadata, '{}'::jsonb),
    original_scheduled_date = COALESCE(
      p_original_scheduled_date,
      t.original_scheduled_date,
      t.due_date
    ),
    original_scheduled_time = COALESCE(
      NULLIF(trim(p_original_scheduled_time), ''),
      t.original_scheduled_time,
      t.scheduled_time
    ),
    updated_at = v_resolved_at
  WHERE t.id = p_task_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL;

  PERFORM public.apply_dispatch_order_updates(
    p_company_id,
    p_post_dispatch_assignments
  );

  INSERT INTO public.task_incident_events (
    incident_id,
    event_type,
    comment,
    created_by
  )
  VALUES (
    p_incident_id,
    'RESCHEDULE',
    NULLIF(trim(COALESCE(p_incident_event_comment, '')), ''),
    p_actor_employee_id
  );

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
    'STATUS_CHANGED',
    'Estado actualizado a RESUELTA.',
    p_actor_employee_id
  );

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'incident_id', p_incident_id,
    'status', 'asignada',
    'incident_status', 'RESUELTA',
    'rescheduled_at', v_resolved_at
  );
END;
$$;

COMMENT ON FUNCTION public.supervisor_reschedule_active_task_from_incident(
  uuid, uuid, uuid, uuid, date, text, uuid, text, text, text, text, text, jsonb, date, text, jsonb, jsonb, text
) IS
  'RC3.1: atomically replan an en-curso OT from an active incident, reset operational checklist metadata, update dispatch_order, and resolve the incident. Callable only via service_role.';

REVOKE ALL ON FUNCTION public.supervisor_reschedule_active_task_from_incident(
  uuid, uuid, uuid, uuid, date, text, uuid, text, text, text, text, text, jsonb, date, text, jsonb, jsonb, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.supervisor_reschedule_active_task_from_incident(
  uuid, uuid, uuid, uuid, date, text, uuid, text, text, text, text, text, jsonb, date, text, jsonb, jsonb, text
) TO service_role;
