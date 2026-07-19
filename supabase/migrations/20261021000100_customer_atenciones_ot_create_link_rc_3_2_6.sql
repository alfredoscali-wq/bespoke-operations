-- RC 3.2.6 — link OT after creation: clear generar_ot pending state for KPI

CREATE OR REPLACE FUNCTION public.link_customer_atencion_to_task(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid,
  p_task_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atencion public.customer_atenciones%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_follow_up text[];
  v_previous_next_step text;
  v_new_next_step text;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL OR p_task_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros obligatorios incompletos para vincular la OT.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'DEMO_READ_ONLY: La plataforma de demostración es de solo lectura.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_ACTOR_TENANT_MISMATCH: El empleado no pertenece al tenant de la consulta.';
  END IF;

  SELECT *
  INTO v_atencion
  FROM public.customer_atenciones ca
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'CONSULTATION_NOT_FOUND: Consulta no encontrada.';
  END IF;

  -- Resolved consultations may link only while follow-up generar_ot is pending.
  IF v_atencion.status = 'resuelta'
     AND NOT ('generar_ot' = ANY (COALESCE(v_atencion.follow_up_actions, '{}'::text[]))) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_ALREADY_RESOLVED: No se puede vincular una OT a una consulta resuelta.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks t
  WHERE t.id = p_task_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'TASK_NOT_FOUND: Orden de trabajo no encontrada.';
  END IF;

  v_previous_next_step := v_atencion.next_step;
  v_new_next_step := CASE
    WHEN v_atencion.next_step = 'generar_ot' THEN NULL
    ELSE v_atencion.next_step
  END;

  v_follow_up := ARRAY(
    SELECT action
    FROM unnest(COALESCE(v_atencion.follow_up_actions, '{}'::text[])) AS action
    WHERE action IS DISTINCT FROM 'generar_ot'
  );

  UPDATE public.customer_atenciones ca
  SET
    linked_task_id = v_task.id,
    linked_task_code = COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    ot_linked_at = now(),
    ot_linked_by_employee_id = p_employee_id,
    next_step = v_new_next_step,
    follow_up_actions = v_follow_up,
    updated_at = now()
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL;

  INSERT INTO public.customer_atencion_events (
    company_id,
    customer_atencion_id,
    employee_id,
    action_type,
    detail,
    previous_status,
    new_status,
    previous_next_step,
    new_next_step
  ) VALUES (
    p_company_id,
    p_atencion_id,
    p_employee_id,
    'consulta_ot_vinculada',
    'Orden de Trabajo creada y vinculada: '
      || COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    v_atencion.status,
    v_atencion.status,
    v_previous_next_step,
    v_new_next_step
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'linked_task_id', v_task.id,
    'linked_task_code', COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    'ot_linked_at', now(),
    'ot_linked_by_employee_id', p_employee_id
  );
END;
$$;

COMMENT ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) IS
  'RC 3.2.6 — link created OT to consultation; clears generar_ot next_step / follow-up for KPI.';
