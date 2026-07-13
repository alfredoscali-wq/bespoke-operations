-- Sprint 2.8: restructure Gestión de Consultas next steps, KPIs semantics, OT link.

-- 1) Link Consulta ↔ OT (trazabilidad; no auto-create OT)
ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_task_code text,
  ADD COLUMN IF NOT EXISTS ot_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS ot_linked_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.customer_atenciones.linked_task_id IS
  'Optional linked work order (tasks.id) for generar_ot circuit; does not auto-close the consulta.';
COMMENT ON COLUMN public.customer_atenciones.linked_task_code IS
  'Denormalized OT code/number for display and audit.';
COMMENT ON COLUMN public.customer_atenciones.ot_linked_at IS
  'When the consulta was linked to an OT.';
COMMENT ON COLUMN public.customer_atenciones.ot_linked_by_employee_id IS
  'Employee who linked the OT to this consulta.';

CREATE INDEX IF NOT EXISTS customer_atenciones_linked_task_id_idx
  ON public.customer_atenciones (company_id, linked_task_id)
  WHERE deleted_at IS NULL AND linked_task_id IS NOT NULL;

-- 2) Remap legacy next_step values before tightening CHECKs
UPDATE public.customer_atenciones
SET next_step = CASE next_step
  WHEN 'resolver_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'facturacion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'analizar_problema_tecnico' THEN 'resolver_consulta_tecnica'
  WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'
  WHEN 'coordinar_retiro' THEN 'generar_ot'
  ELSE next_step
END
WHERE next_step IN (
  'resolver_facturacion',
  'facturacion_morosos',
  'analizar_problema_tecnico',
  'esperar_administracion',
  'coordinar_retiro'
)
  AND deleted_at IS NULL;

-- Internal remapped steps must not stay as pendiente solely due to esperar_administracion
UPDATE public.customer_atenciones
SET status = 'para_resolver',
    updated_at = now()
WHERE deleted_at IS NULL
  AND status = 'pendiente'
  AND next_step IN (
    'derivar_admin_gestion',
    'derivar_admin_facturacion',
    'derivar_admin_morosos',
    'resolver_consulta_tecnica',
    'realizar_retencion',
    'contactar_cliente',
    'seguimiento_cliente',
    'generar_ot'
  );

UPDATE public.customer_atencion_events
SET previous_next_step = CASE previous_next_step
  WHEN 'resolver_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'facturacion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'analizar_problema_tecnico' THEN 'resolver_consulta_tecnica'
  WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'
  WHEN 'coordinar_retiro' THEN 'generar_ot'
  ELSE previous_next_step
END
WHERE previous_next_step IN (
  'resolver_facturacion',
  'facturacion_morosos',
  'analizar_problema_tecnico',
  'esperar_administracion',
  'coordinar_retiro'
);

UPDATE public.customer_atencion_events
SET new_next_step = CASE new_next_step
  WHEN 'resolver_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'facturacion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'analizar_problema_tecnico' THEN 'resolver_consulta_tecnica'
  WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'
  WHEN 'coordinar_retiro' THEN 'generar_ot'
  ELSE new_next_step
END
WHERE new_next_step IN (
  'resolver_facturacion',
  'facturacion_morosos',
  'analizar_problema_tecnico',
  'esperar_administracion',
  'coordinar_retiro'
);

-- 3) Replace CHECKs with Sprint 2.8 vocabulary
ALTER TABLE public.customer_atencion_events
  DROP CONSTRAINT IF EXISTS customer_atencion_events_action_type_check;

ALTER TABLE public.customer_atencion_events
  ADD CONSTRAINT customer_atencion_events_action_type_check CHECK (
    action_type IN (
      'consulta_creada',
      'gestion_iniciada',
      'gestion_registrada',
      'consulta_pendiente',
      'consulta_resuelta',
      'proximo_paso_cambiado',
      'consulta_ot_vinculada'
    )
  );

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_next_step_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_next_step_check CHECK (
    next_step IS NULL
    OR next_step IN (
      'realizar_retencion',
      'resolver_consulta_tecnica',
      'derivar_admin_facturacion',
      'derivar_admin_morosos',
      'derivar_admin_gestion',
      'contactar_cliente',
      'seguimiento_cliente',
      'esperar_cliente',
      'generar_ot'
    )
  );

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_moroso_tracking_next_step_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_moroso_tracking_next_step_check CHECK (
    moroso_tracking_status IS NULL
    OR next_step = 'derivar_admin_morosos'
  );

ALTER TABLE public.customer_atencion_events
  DROP CONSTRAINT IF EXISTS customer_atencion_events_previous_next_step_check;

ALTER TABLE public.customer_atencion_events
  ADD CONSTRAINT customer_atencion_events_previous_next_step_check CHECK (
    previous_next_step IS NULL
    OR previous_next_step IN (
      'realizar_retencion',
      'resolver_consulta_tecnica',
      'derivar_admin_facturacion',
      'derivar_admin_morosos',
      'derivar_admin_gestion',
      'contactar_cliente',
      'seguimiento_cliente',
      'esperar_cliente',
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
      'resolver_consulta_tecnica',
      'derivar_admin_facturacion',
      'derivar_admin_morosos',
      'derivar_admin_gestion',
      'contactar_cliente',
      'seguimiento_cliente',
      'esperar_cliente',
      'generar_ot'
    )
  );

-- 4) Resolve RPC (clear moroso + keep OT link for audit)
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

-- 5) Defer RPC — only esperar_cliente → pendiente
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
       'resolver_consulta_tecnica',
       'derivar_admin_facturacion',
       'derivar_admin_morosos',
       'derivar_admin_gestion',
       'contactar_cliente',
       'seguimiento_cliente',
       'esperar_cliente',
       'generar_ot'
     ) THEN
    RAISE EXCEPTION 'CONSULTATION_NEXT_STEP_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Seleccioná el próximo paso para continuar después.';
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

-- 6) Moroso tracking — accept derivar_admin_morosos
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

  IF v_atencion.next_step IS DISTINCT FROM 'derivar_admin_morosos' THEN
    RAISE EXCEPTION 'MOROSO_TRACKING_NOT_APPLICABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El seguimiento de morosos solo aplica a consultas de Administración - Morosos.';
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

-- 7) Link Consulta ↔ OT without closing the consulta
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
    RAISE EXCEPTION 'CONSULTATION_INVALID_PARAMETERS'
      USING ERRCODE = 'invalid_parameter_value',
            MESSAGE = 'Parámetros obligatorios incompletos para vincular la OT.';
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

  IF v_atencion.status = 'resuelta' THEN
    RAISE EXCEPTION 'CONSULTATION_ALREADY_RESOLVED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'No se puede vincular una OT a una consulta resuelta.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks t
  WHERE t.id = p_task_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation',
            MESSAGE = 'Orden de trabajo no encontrada.';
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

COMMENT ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) IS
  'Sprint 2.8: link an existing OT to a consulta without closing it. service_role only.';

REVOKE ALL ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) TO service_role;
