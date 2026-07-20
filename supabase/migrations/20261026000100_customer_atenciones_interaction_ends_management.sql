-- End active management session after contact/note interactions.
--
-- Extracts shared release logic used by:
--   - cancel_customer_atencion_management
--   - register_customer_atencion_interaction (contact | note only)
--
-- Process interactions (kind = process) do NOT release the session.
-- next_step is never changed (tray membership unchanged).

-- ---------------------------------------------------------------------------
-- Shared session-end helper (single source of truth)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_customer_atencion_management_session_end(
  p_atencion public.customer_atenciones,
  p_employee_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restore_status text;
BEGIN
  IF p_atencion.status IS DISTINCT FROM 'en_gestion'
     OR p_atencion.active_management_employee_id IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH: Solo quien gestiona actualmente la Consulta puede finalizar la gestión.';
  END IF;

  SELECT e.previous_status
  INTO v_restore_status
  FROM public.customer_atencion_events e
  WHERE e.customer_atencion_id = p_atencion.id
    AND e.company_id = p_atencion.company_id
    AND e.employee_id = p_employee_id
    AND e.action_type = 'gestion_iniciada'
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF v_restore_status IS NULL OR v_restore_status NOT IN ('para_resolver', 'pendiente', 'nueva') THEN
    v_restore_status := 'para_resolver';
  END IF;

  -- Keep next_step. Clear exclusive lock. Restore shared status.
  UPDATE public.customer_atenciones ca
  SET
    status = v_restore_status,
    active_management_employee_id = NULL,
    active_management_started_at = NULL,
    active_management_last_activity_at = NULL,
    updated_at = now()
  WHERE ca.id = p_atencion.id
    AND ca.company_id = p_atencion.company_id
    AND ca.deleted_at IS NULL;

  RETURN v_restore_status;
END;
$$;

COMMENT ON FUNCTION public.apply_customer_atencion_management_session_end(
  public.customer_atenciones, uuid
) IS
  'Shared end of exclusive management session: restore shared status, clear lock, keep next_step. No event insert.';

REVOKE ALL ON FUNCTION public.apply_customer_atencion_management_session_end(
  public.customer_atenciones, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_customer_atencion_management_session_end(
  public.customer_atenciones, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- cancel — reuse shared helper
-- ---------------------------------------------------------------------------

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

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  v_restore_status := public.apply_customer_atencion_management_session_end(
    v_atencion,
    p_employee_id
  );

  -- Intentionally no INSERT into customer_atencion_events (RC 3.2.3).

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', v_restore_status,
    'previous_next_step', v_previous_next_step,
    'new_next_step', v_previous_next_step
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) IS
  'Cancels exclusive management via shared session-end helper; keeps next_step; no event.';

-- ---------------------------------------------------------------------------
-- register interaction — release session only for contact | note
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
  v_management_released boolean := false;
  v_new_status text;
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

  -- Touch activity clock. Never mutate next_step here.
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

  -- Contact / note close the work session. Process does not.
  IF v_kind IN ('contact', 'note')
     AND v_atencion.status = 'en_gestion'
     AND v_atencion.active_management_employee_id IS NOT DISTINCT FROM p_employee_id THEN
    v_new_status := public.apply_customer_atencion_management_session_end(
      v_atencion,
      p_employee_id
    );
    v_management_released := true;
  ELSE
    v_new_status := v_atencion.status;
  END IF;

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'event_id', v_event_id,
    'interaction_kind', v_kind,
    'interaction_result', v_result,
    'next_action_at', p_next_action_at,
    'status', v_new_status,
    'next_step', v_atencion.next_step,
    'management_released', v_management_released
  );
END;
$$;

COMMENT ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamptz
) IS
  'Registers non-tray interaction. contact|note also end exclusive management via shared helper; process does not.';

REVOKE ALL ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamptz
) TO service_role;
