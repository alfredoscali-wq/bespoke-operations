-- Atención al Cliente 2.0 Sprint 2.3 — Gestión compartida autoritativa de Consultas
--
-- RPCs transaccionales (service_role only):
--   start_customer_atencion_management
--   resolve_customer_atencion_consultation
--   defer_customer_atencion_consultation
--
-- Demo read-only: requireWritablePlatformSession en API + check en RPC.
-- NO ejecutar automáticamente: aplicar manualmente en Supabase SQL Editor.

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
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'CONSULTATION_INVALID_PARAMETERS'
      USING ERRCODE = 'invalid_parameter_value',
            MESSAGE = 'Parámetros obligatorios incompletos para iniciar gestión.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'La plataforma de demostración es de solo lectura.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'CONSULTATION_ACTOR_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado no pertenece al tenant de la consulta.';
  END IF;

  SELECT *
  INTO v_atencion
  FROM public.customer_atenciones ca
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONSULTATION_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation',
            MESSAGE = 'Consulta no encontrada.';
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

    RAISE EXCEPTION 'CONSULTATION_ALREADY_IN_MANAGEMENT'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Esta Consulta ya está siendo gestionada por otra persona.';
  END IF;

  IF v_atencion.status NOT IN ('para_resolver', 'pendiente') THEN
    RAISE EXCEPTION 'CONSULTATION_NOT_AVAILABLE_FOR_MANAGEMENT'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'La Consulta no está disponible para iniciar gestión.';
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

CREATE OR REPLACE FUNCTION public.resolve_customer_atencion_consultation(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid,
  p_resolution text
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
  v_resolution text := nullif(trim(COALESCE(p_resolution, '')), '');
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'CONSULTATION_INVALID_PARAMETERS'
      USING ERRCODE = 'invalid_parameter_value',
            MESSAGE = 'Parámetros obligatorios incompletos para resolver la consulta.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'La plataforma de demostración es de solo lectura.';
  END IF;

  IF v_resolution IS NULL THEN
    RAISE EXCEPTION 'CONSULTATION_RESOLUTION_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Completá la resolución de la consulta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'CONSULTATION_ACTOR_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado no pertenece al tenant de la consulta.';
  END IF;

  SELECT *
  INTO v_atencion
  FROM public.customer_atenciones ca
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONSULTATION_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation',
            MESSAGE = 'Consulta no encontrada.';
  END IF;

  IF v_atencion.status <> 'en_gestion'
     OR v_atencion.active_management_employee_id IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Solo quien gestiona actualmente la Consulta puede resolverla.';
  END IF;

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  UPDATE public.customer_atenciones ca
  SET
    status = 'resuelta',
    next_step = NULL,
    resultado = 'resuelta',
    resolution = v_resolution,
    active_management_employee_id = NULL,
    active_management_started_at = NULL,
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
    'consulta_resuelta',
    v_resolution,
    v_previous_status,
    'resuelta',
    v_previous_next_step,
    NULL
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', 'resuelta',
    'previous_next_step', v_previous_next_step,
    'new_next_step', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.defer_customer_atencion_consultation(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid,
  p_next_step text
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
  v_new_status text;
  v_next_step text := nullif(trim(COALESCE(p_next_step, '')), '');
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'CONSULTATION_INVALID_PARAMETERS'
      USING ERRCODE = 'invalid_parameter_value',
            MESSAGE = 'Parámetros obligatorios incompletos para continuar después.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'La plataforma de demostración es de solo lectura.';
  END IF;

  IF v_next_step IS NULL
     OR v_next_step NOT IN (
       'realizar_retencion',
       'resolver_facturacion',
       'analizar_problema_tecnico',
       'contactar_cliente',
       'esperar_cliente',
       'esperar_administracion',
       'coordinar_retiro',
       'generar_ot'
     ) THEN
    RAISE EXCEPTION 'CONSULTATION_NEXT_STEP_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Seleccioná el próximo paso para continuar después.';
  END IF;

  v_new_status := CASE
    WHEN v_next_step IN ('esperar_cliente', 'esperar_administracion') THEN 'pendiente'
    ELSE 'para_resolver'
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'CONSULTATION_ACTOR_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado no pertenece al tenant de la consulta.';
  END IF;

  SELECT *
  INTO v_atencion
  FROM public.customer_atenciones ca
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONSULTATION_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation',
            MESSAGE = 'Consulta no encontrada.';
  END IF;

  IF v_atencion.status <> 'en_gestion'
     OR v_atencion.active_management_employee_id IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Solo quien gestiona actualmente la Consulta puede continuar después.';
  END IF;

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  UPDATE public.customer_atenciones ca
  SET
    status = v_new_status,
    next_step = v_next_step,
    resultado = 'requiere_seguimiento',
    resolution = 'Consulta devuelta a la bandeja compartida.',
    active_management_employee_id = NULL,
    active_management_started_at = NULL,
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
    'consulta_pendiente',
    v_previous_status,
    v_new_status,
    v_previous_next_step,
    v_next_step
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', v_new_status,
    'previous_next_step', v_previous_next_step,
    'new_next_step', v_next_step
  );
END;
$$;

COMMENT ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) IS
  'Sprint 2.3: atomically start shared management on a Consulta (para_resolver|pendiente → en_gestion). service_role only.';

COMMENT ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text) IS
  'Sprint 2.3: atomically resolve an in-management Consulta and record consulta_resuelta. service_role only.';

COMMENT ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text) IS
  'Sprint 2.3: atomically defer/continue-after an in-management Consulta and record consulta_pendiente. service_role only.';

REVOKE ALL ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text) TO service_role;
