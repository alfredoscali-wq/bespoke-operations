-- Sprint 2.6: Facturación - Morosos next step + internal moroso tracking for Administración.

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS moroso_tracking_status text;

COMMENT ON COLUMN public.customer_atenciones.moroso_tracking_status IS
  'Internal Administración tracking for facturacion_morosos consultas; independent from status.';

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_next_step_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_next_step_check CHECK (
    next_step IS NULL
    OR next_step IN (
      'realizar_retencion',
      'resolver_facturacion',
      'facturacion_morosos',
      'analizar_problema_tecnico',
      'contactar_cliente',
      'esperar_cliente',
      'esperar_administracion',
      'coordinar_retiro',
      'generar_ot'
    )
  );

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_moroso_tracking_status_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_moroso_tracking_status_check CHECK (
    moroso_tracking_status IS NULL
    OR moroso_tracking_status IN (
      'cupon_pendiente_enviar',
      'cupon_enviado',
      'esperando_acreditacion',
      'pago_acreditado',
      'servicio_rehabilitado'
    )
  );

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_moroso_tracking_next_step_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_moroso_tracking_next_step_check CHECK (
    moroso_tracking_status IS NULL
    OR next_step = 'facturacion_morosos'
  );

ALTER TABLE public.customer_atencion_events
  DROP CONSTRAINT IF EXISTS customer_atencion_events_previous_next_step_check;

ALTER TABLE public.customer_atencion_events
  ADD CONSTRAINT customer_atencion_events_previous_next_step_check CHECK (
    previous_next_step IS NULL
    OR previous_next_step IN (
      'realizar_retencion',
      'resolver_facturacion',
      'facturacion_morosos',
      'analizar_problema_tecnico',
      'contactar_cliente',
      'esperar_cliente',
      'esperar_administracion',
      'coordinar_retiro',
      'generar_ot'
    )
  );

ALTER TABLE public.customer_atencion_events
  DROP CONSTRAINT IF EXISTS customer_atencion_events_new_next_step_check;

ALTER TABLE public.customer_atencion_events
  ADD CONSTRAINT customer_atencion_events_new_next_step_check CHECK (
    new_next_step IS NULL
    OR new_next_step IN (
      'realizar_retencion',
      'resolver_facturacion',
      'facturacion_morosos',
      'analizar_problema_tecnico',
      'contactar_cliente',
      'esperar_cliente',
      'esperar_administracion',
      'coordinar_retiro',
      'generar_ot'
    )
  );

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
    moroso_tracking_status = NULL,
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
  p_next_step text,
  p_detail text DEFAULT NULL
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
  v_detail text := nullif(trim(COALESCE(p_detail, '')), '');
  v_resolution text;
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
       'facturacion_morosos',
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

  v_resolution := CASE
    WHEN v_detail IS NOT NULL THEN v_detail
    ELSE 'Consulta devuelta a la bandeja compartida.'
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
    resolution = v_resolution,
    moroso_tracking_status = CASE
      WHEN v_next_step = 'facturacion_morosos' THEN 'cupon_pendiente_enviar'
      ELSE NULL
    END,
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
    'consulta_pendiente',
    v_detail,
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

CREATE OR REPLACE FUNCTION public.update_customer_atencion_moroso_tracking(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid,
  p_tracking_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atencion public.customer_atenciones%ROWTYPE;
  v_tracking_status text := nullif(trim(COALESCE(p_tracking_status, '')), '');
  v_previous_tracking_status text;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'CONSULTATION_INVALID_PARAMETERS'
      USING ERRCODE = 'invalid_parameter_value',
            MESSAGE = 'Parámetros obligatorios incompletos para actualizar el seguimiento.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'La plataforma de demostración es de solo lectura.';
  END IF;

  IF v_tracking_status IS NULL
     OR v_tracking_status NOT IN (
       'cupon_pendiente_enviar',
       'cupon_enviado',
       'esperando_acreditacion',
       'pago_acreditado',
       'servicio_rehabilitado'
     ) THEN
    RAISE EXCEPTION 'MOROSO_TRACKING_STATUS_INVALID'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Seleccioná un estado de seguimiento válido.';
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

  IF v_atencion.next_step IS DISTINCT FROM 'facturacion_morosos' THEN
    RAISE EXCEPTION 'MOROSO_TRACKING_NOT_APPLICABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El seguimiento de morosos solo aplica a consultas de Facturación - Morosos.';
  END IF;

  IF v_atencion.status = 'resuelta' THEN
    RAISE EXCEPTION 'CONSULTATION_ALREADY_RESOLVED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'No se puede actualizar el seguimiento de una consulta resuelta.';
  END IF;

  v_previous_tracking_status := v_atencion.moroso_tracking_status;

  UPDATE public.customer_atenciones ca
  SET
    moroso_tracking_status = v_tracking_status,
    updated_at = now()
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_tracking_status', v_previous_tracking_status,
    'new_tracking_status', v_tracking_status
  );
END;
$$;

COMMENT ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) IS
  'Sprint 2.6: update internal moroso tracking for facturacion_morosos consultas. service_role only.';

REVOKE ALL ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) TO service_role;
