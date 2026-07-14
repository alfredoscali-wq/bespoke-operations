-- Hotfix: RAISE EXCEPTION ... USING MESSAGE (duplicate MESSAGE option).
-- PostgreSQL treats the RAISE format string as MESSAGE; USING MESSAGE again fails with
-- "RAISE option already specified: MESSAGE".
-- Rewrite to RAISE EXCEPTION USING ERRCODE/MESSAGE only. No business-logic changes.
-- from supabase/migrations/20261005000100_customer_atenciones_sprint_2_0.sql
CREATE OR REPLACE FUNCTION public.enforce_customer_atenciones_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CUSTOMER_ATENCION_CUSTOMER_TENANT_MISMATCH: El cliente referenciado no pertenece al tenant de la consulta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.attended_by_employee_id
      AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CUSTOMER_ATENCION_ATTENDED_EMPLOYEE_TENANT_MISMATCH: El empleado que atendió no pertenece al tenant de la consulta.';
  END IF;

  IF NEW.active_management_employee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.employees e
       WHERE e.id = NEW.active_management_employee_id
         AND e.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CUSTOMER_ATENCION_ACTIVE_MANAGEMENT_EMPLOYEE_TENANT_MISMATCH: El empleado en gestión activa no pertenece al tenant de la consulta.';
  END IF;

  RETURN NEW;
END;
$$;

-- from supabase/migrations/20261005000100_customer_atenciones_sprint_2_0.sql
CREATE OR REPLACE FUNCTION public.enforce_customer_atencion_events_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_atenciones ca
    WHERE ca.id = NEW.customer_atencion_id
      AND ca.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CUSTOMER_ATENCION_EVENT_ATENCION_TENANT_MISMATCH: La consulta referenciada no pertenece al tenant del evento.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.employee_id
      AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CUSTOMER_ATENCION_EVENT_EMPLOYEE_TENANT_MISMATCH: El empleado actor no pertenece al tenant del evento.';
  END IF;

  RETURN NEW;
END;
$$;

-- from supabase/migrations/20261006000100_customer_atenciones_sprint_2_3_shared_management.sql
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

-- from supabase/migrations/20261011000100_customer_atenciones_sprint_2_8_next_step_restructure.sql
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

-- from supabase/migrations/20261011000100_customer_atenciones_sprint_2_8_next_step_restructure.sql
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

-- from supabase/migrations/20261011000100_customer_atenciones_sprint_2_8_next_step_restructure.sql
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
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros obligatorios incompletos para actualizar el seguimiento.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'DEMO_READ_ONLY: La plataforma de demostración es de solo lectura.';
  END IF;

  IF v_tracking_status IS NULL
     OR v_tracking_status NOT IN (
       'cupon_pendiente_enviar',
       'cupon_enviado',
       'esperando_acreditacion',
       'pago_acreditado',
       'servicio_rehabilitado'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'MOROSO_TRACKING_STATUS_INVALID: Seleccioná un estado de seguimiento válido.';
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

  IF v_atencion.next_step IS DISTINCT FROM 'derivar_admin_morosos' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'MOROSO_TRACKING_NOT_APPLICABLE: El seguimiento de morosos solo aplica a consultas de Administración - Morosos.';
  END IF;

  IF v_atencion.status = 'resuelta' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_ALREADY_RESOLVED: No se puede actualizar el seguimiento de una consulta resuelta.';
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

-- from supabase/migrations/20261011000100_customer_atenciones_sprint_2_8_next_step_restructure.sql
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

  IF v_atencion.status = 'resuelta' THEN
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

  UPDATE public.customer_atenciones ca
  SET
    linked_task_id = v_task.id,
    linked_task_code = COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    ot_linked_at = now(),
    ot_linked_by_employee_id = p_employee_id,
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
    'OT vinculada: ' || COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    v_atencion.status,
    v_atencion.status,
    v_atencion.next_step,
    v_atencion.next_step
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
