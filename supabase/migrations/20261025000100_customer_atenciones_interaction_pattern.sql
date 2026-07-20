-- RC 4.x — Generic consultation interaction pattern (first vertical: Morosos).
--
-- Architecture (three independent layers):
--   1. Consultation state (status + next_step) — tray / responsible area.
--      Changes only via business decisions (defer / resolve / OT link).
--   2. Interactions (activities) — contacts, notes, promises, etc.
--      Never change the tray. Stored as customer_atencion_events.
--   3. Process state — circuit-specific progress (e.g. moroso_tracking_status).
--      Never changes the tray. Updates also leave an interaction event.
--
-- Schema note:
--   customer_atencion_events had no metadata/payload column. Minimal extension:
--   interaction_kind, interaction_result, next_action_at.
--   Operator is already explicit via employee_id (NOT NULL).
--
-- action_type:
--   Existing values remain lifecycle vocabulary.
--   New: interaccion_registrada — non-tray-changing interaction.
--
-- Compatibility: legacy events keep NULL interaction_* columns.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.customer_atencion_events
  ADD COLUMN IF NOT EXISTS interaction_kind text;

ALTER TABLE public.customer_atencion_events
  ADD COLUMN IF NOT EXISTS interaction_result text;

ALTER TABLE public.customer_atencion_events
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz;

ALTER TABLE public.customer_atencion_events
  DROP CONSTRAINT IF EXISTS customer_atencion_events_interaction_kind_check;

ALTER TABLE public.customer_atencion_events
  ADD CONSTRAINT customer_atencion_events_interaction_kind_check CHECK (
    interaction_kind IS NULL
    OR interaction_kind IN (
      'contact',
      'note',
      'process',
      'decision',
      'system'
    )
  );

COMMENT ON COLUMN public.customer_atencion_events.interaction_kind IS
  'Generic interaction class: contact | note | process | decision | system. NULL for legacy lifecycle-only events.';

COMMENT ON COLUMN public.customer_atencion_events.interaction_result IS
  'Module-specific result code (e.g. no_atiende, cupon_enviado). Interpreted by the owning circuit.';

COMMENT ON COLUMN public.customer_atencion_events.next_action_at IS
  'Optional scheduled next action (call again, verify payment, wait for docs, etc.).';

-- ---------------------------------------------------------------------------
-- 2. action_type vocabulary
-- ---------------------------------------------------------------------------

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
      'consulta_ot_vinculada',
      'gestion_liberada_por_inactividad',
      'interaccion_registrada'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Core RPC — register interaction (never changes tray)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_customer_atencion_interaction(
  p_company_id uuid,
  p_atencion_id uuid,
  p_employee_id uuid,
  p_interaction_kind text,
  p_interaction_result text,
  p_detail text,
  p_next_action_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atencion public.customer_atenciones%ROWTYPE;
  v_kind text := lower(nullif(trim(COALESCE(p_interaction_kind, '')), ''));
  v_result text := nullif(trim(COALESCE(p_interaction_result, '')), '');
  v_detail text := nullif(trim(COALESCE(p_detail, '')), '');
  v_event_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros obligatorios incompletos para registrar la interacción.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'DEMO_READ_ONLY: La plataforma de demostración es de solo lectura.';
  END IF;

  IF v_kind IS NULL
     OR v_kind NOT IN ('contact', 'note', 'process', 'decision', 'system') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'INTERACTION_KIND_INVALID: Tipo de interacción no válido.';
  END IF;

  IF v_detail IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'INTERACTION_DETAIL_REQUIRED: Completá el detalle de la interacción.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.company_id = p_company_id
      AND e.deleted_at IS NULL
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
      MESSAGE = 'CONSULTATION_ALREADY_RESOLVED: No se puede registrar interacciones en una consulta resuelta.';
  END IF;

  -- Touch activity clock only. Never mutate status / next_step / process columns here.
  UPDATE public.customer_atenciones ca
  SET updated_at = now()
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
    new_next_step,
    interaction_kind,
    interaction_result,
    next_action_at
  ) VALUES (
    p_company_id,
    p_atencion_id,
    p_employee_id,
    'interaccion_registrada',
    v_detail,
    v_atencion.status,
    v_atencion.status,
    v_atencion.next_step,
    v_atencion.next_step,
    v_kind,
    v_result,
    p_next_action_at
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'event_id', v_event_id,
    'interaction_kind', v_kind,
    'interaction_result', v_result,
    'next_action_at', p_next_action_at,
    'status', v_atencion.status,
    'next_step', v_atencion.next_step
  );
END;
$$;

COMMENT ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamptz
) IS
  'Registers a non-tray-changing consultation interaction (contact/note/process/decision/system). Updates updated_at only.';

REVOKE ALL ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamptz
) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Moroso tracking — still process-only; now also writes interaction event
-- ---------------------------------------------------------------------------

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
  v_detail text;
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
      AND e.deleted_at IS NULL
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

  v_detail := CASE v_tracking_status
    WHEN 'cupon_pendiente_enviar' THEN 'Proceso de cobranza: Cupón pendiente de enviar.'
    WHEN 'cupon_enviado' THEN 'Proceso de cobranza: Cupón enviado.'
    WHEN 'esperando_acreditacion' THEN 'Proceso de cobranza: Esperando acreditación.'
    WHEN 'pago_acreditado' THEN 'Proceso de cobranza: Pago acreditado.'
    WHEN 'servicio_rehabilitado' THEN 'Proceso de cobranza: Servicio rehabilitado.'
    ELSE 'Proceso de cobranza actualizado.'
  END;

  INSERT INTO public.customer_atencion_events (
    company_id,
    customer_atencion_id,
    employee_id,
    action_type,
    detail,
    previous_status,
    new_status,
    previous_next_step,
    new_next_step,
    interaction_kind,
    interaction_result,
    next_action_at
  ) VALUES (
    p_company_id,
    p_atencion_id,
    p_employee_id,
    'interaccion_registrada',
    v_detail,
    v_atencion.status,
    v_atencion.status,
    v_atencion.next_step,
    v_atencion.next_step,
    'process',
    v_tracking_status,
    NULL
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_tracking_status', v_previous_tracking_status,
    'new_tracking_status', v_tracking_status
  );
END;
$$;

COMMENT ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) IS
  'Updates moroso process state only (no tray change) and records a process interaction event.';

REVOKE ALL ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) TO service_role;
