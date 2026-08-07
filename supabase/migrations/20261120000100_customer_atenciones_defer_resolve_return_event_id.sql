-- Sprint 39.0 (events.latest elimination) — return event_id from defer/resolve RPCs.
-- Lets handlers skip the post-RPC customer_atencion_events lookup (~100 ms)
-- while keeping attachment linking + activity metadata identical.

CREATE OR REPLACE FUNCTION public.resolve_customer_atencion_consultation(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid,
  p_resolution text,
  p_follow_up_actions text[] DEFAULT '{}'::text[]
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
  v_follow_up text[] := COALESCE(p_follow_up_actions, '{}'::text[]);
  v_event_detail text;
  v_event_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros obligatorios incompletos para resolver la consulta.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'DEMO_READ_ONLY: La plataforma de demostración es de solo lectura.';
  END IF;

  IF v_resolution IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_RESOLUTION_REQUIRED: Completá la resolución de la consulta.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_follow_up) AS action
    WHERE action IS NOT NULL
      AND nullif(trim(action), '') IS NOT NULL
      AND trim(action) <> 'generar_ot'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_INVALID_FOLLOW_UP: Acción posterior no válida.';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT trim(action) ORDER BY trim(action)), '{}'::text[])
  INTO v_follow_up
  FROM unnest(v_follow_up) AS action
  WHERE action IS NOT NULL
    AND nullif(trim(action), '') IS NOT NULL
    AND trim(action) = 'generar_ot';

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
      MESSAGE = 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH: Solo quien gestiona actualmente la Consulta puede resolverla.';
  END IF;

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  v_event_detail := v_resolution;
  IF 'generar_ot' = ANY (v_follow_up) THEN
    v_event_detail := v_resolution || E'\n\n[[follow_up:generar_ot]]';
  END IF;

  UPDATE public.customer_atenciones ca
  SET
    status = 'resuelta',
    next_step = NULL,
    resultado = 'resuelta',
    resolution = v_resolution,
    follow_up_actions = v_follow_up,
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
    v_event_detail,
    v_previous_status,
    'resuelta',
    v_previous_next_step,
    NULL
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', 'resuelta',
    'previous_next_step', v_previous_next_step,
    'new_next_step', NULL,
    'follow_up_actions', to_jsonb(v_follow_up),
    'event_id', v_event_id
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
  v_event_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros obligatorios incompletos para continuar después.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'DEMO_READ_ONLY: La plataforma de demostración es de solo lectura.';
  END IF;

  IF v_next_step IS NULL
     OR v_next_step NOT IN (
       'realizar_retencion',
       'resolver_consulta_tecnica',
       'derivar_admin_facturacion',
       'derivar_admin_morosos',
       'derivar_admin_gestion',
       'contactar_cliente',
       'seguimiento_cliente',
       'esperar_cliente',
       'generar_ot'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_NEXT_STEP_REQUIRED: Seleccioná el próximo paso para continuar después.';
  END IF;

  v_new_status := CASE
    WHEN v_next_step = 'esperar_cliente' THEN 'pendiente'
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
      MESSAGE = 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH: Solo quien gestiona actualmente la Consulta puede continuar después.';
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
      WHEN v_next_step = 'derivar_admin_morosos' THEN COALESCE(ca.moroso_tracking_status, 'cupon_pendiente_enviar')
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
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', v_new_status,
    'previous_next_step', v_previous_next_step,
    'new_next_step', v_next_step,
    'event_id', v_event_id
  );
END;
$$;

COMMENT ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) IS
  'Resolve in-management Consulta; returns event_id for attachment linking (Sprint 39.0 events.latest elimination).';

COMMENT ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text, text) IS
  'Defer/continue-after in-management Consulta; returns event_id for attachment linking (Sprint 39.0 events.latest elimination).';
