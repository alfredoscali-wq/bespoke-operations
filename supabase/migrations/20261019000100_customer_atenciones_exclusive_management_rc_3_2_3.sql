-- RC 3.2.3 — exclusive management: one en_gestion per operator + cancel without historial

CREATE OR REPLACE FUNCTION public.start_customer_atencion_management(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atencion public.customer_atenciones%ROWTYPE;
  v_previous_status text;
  v_previous_next_step text;
  v_blocking_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros obligatorios incompletos para iniciar gestión.';
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

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  IF v_atencion.status = 'en_gestion' THEN
    IF v_atencion.active_management_employee_id = p_employee_id THEN
      RETURN jsonb_build_object(
        'atencion_id', v_atencion.id,
        'previous_status', v_previous_status,
        'new_status', v_atencion.status,
        'previous_next_step', v_previous_next_step,
        'new_next_step', v_atencion.next_step,
        'idempotent', true
      );
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_ALREADY_IN_MANAGEMENT: Esta Consulta ya está siendo gestionada por otra persona.';
  END IF;

  -- RC 3.2.3 — operator may only have one en_gestion at a time
  SELECT ca.id
  INTO v_blocking_id
  FROM public.customer_atenciones ca
  WHERE ca.company_id = p_company_id
    AND ca.deleted_at IS NULL
    AND ca.status = 'en_gestion'
    AND ca.active_management_employee_id = p_employee_id
    AND ca.id <> p_atencion_id
  LIMIT 1;

  IF v_blocking_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_OPERATOR_ALREADY_MANAGING: Ya tenés otra consulta en gestión.|blocking_atencion_id=' || v_blocking_id::text;
  END IF;

  IF v_atencion.status NOT IN ('para_resolver', 'pendiente') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_NOT_AVAILABLE_FOR_MANAGEMENT: La Consulta no está disponible para iniciar gestión.';
  END IF;

  UPDATE public.customer_atenciones ca
  SET
    status = 'en_gestion',
    active_management_employee_id = p_employee_id,
    active_management_started_at = now(),
    updated_at = now()
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL;

  INSERT INTO public.customer_atencion_events (
    company_id,
    customer_atencion_id,
    employee_id,
    action_type,
    previous_status,
    new_status,
    previous_next_step,
    new_next_step
  ) VALUES (
    p_company_id,
    p_atencion_id,
    p_employee_id,
    'gestion_iniciada',
    v_previous_status,
    'en_gestion',
    v_previous_next_step,
    v_atencion.next_step
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', 'en_gestion',
    'previous_next_step', v_previous_next_step,
    'new_next_step', v_atencion.next_step,
    'idempotent', false
  );
END;
$$;

COMMENT ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) IS
  'RC 3.2.3 — start management; blocks if the operator already has another en_gestion.';

-- Cancel / release management without historial noise
CREATE OR REPLACE FUNCTION public.cancel_customer_atencion_management(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atencion public.customer_atenciones%ROWTYPE;
  v_previous_status text;
  v_previous_next_step text;
  v_restore_status text;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros obligatorios incompletos para cancelar gestión.';
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

  IF v_atencion.status <> 'en_gestion'
     OR v_atencion.active_management_employee_id IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH: Solo quien gestiona actualmente la Consulta puede cancelar la gestión.';
  END IF;

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  -- Restore status from the matching gestion_iniciada event (no new historial row).
  SELECT e.previous_status
  INTO v_restore_status
  FROM public.customer_atencion_events e
  WHERE e.customer_atencion_id = p_atencion_id
    AND e.company_id = p_company_id
    AND e.employee_id = p_employee_id
    AND e.action_type = 'gestion_iniciada'
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF v_restore_status IS NULL OR v_restore_status NOT IN ('para_resolver', 'pendiente', 'nueva') THEN
    v_restore_status := 'para_resolver';
  END IF;

  UPDATE public.customer_atenciones ca
  SET
    status = v_restore_status,
    active_management_employee_id = NULL,
    active_management_started_at = NULL,
    updated_at = now()
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL;

  -- Intentionally no INSERT into customer_atencion_events (RC 3.2.3).

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', v_restore_status,
    'previous_next_step', v_previous_next_step,
    'new_next_step', v_atencion.next_step
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) IS
  'RC 3.2.3 — release en_gestion without writing historial; restores prior tray status.';

REVOKE ALL ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) TO service_role;
