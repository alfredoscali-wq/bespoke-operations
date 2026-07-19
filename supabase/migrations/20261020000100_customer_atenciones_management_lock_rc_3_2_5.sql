-- RC 3.2.5 — exclusive consultation lock: last activity, expiry release, richer lock errors

-- ---------------------------------------------------------------------------
-- Configurable inactivity timeout (minutes). Change this function to tune TTL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_atencion_management_lock_timeout_minutes()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 15;
$$;

COMMENT ON FUNCTION public.customer_atencion_management_lock_timeout_minutes() IS
  'RC 3.2.5 — inactivity minutes before an en_gestion lock expires. Configurable.';

-- ---------------------------------------------------------------------------
-- Last activity column + sync trigger (keeps resolve/defer clears consistent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS active_management_last_activity_at timestamptz;

COMMENT ON COLUMN public.customer_atenciones.active_management_last_activity_at IS
  'RC 3.2.5 — last operator activity while holding en_gestion; used for lock expiry.';

CREATE OR REPLACE FUNCTION public.sync_customer_atencion_management_last_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.active_management_employee_id IS NULL THEN
    NEW.active_management_last_activity_at := NULL;
  ELSIF NEW.active_management_last_activity_at IS NULL THEN
    NEW.active_management_last_activity_at := COALESCE(
      NEW.active_management_started_at,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_atencion_management_last_activity
  ON public.customer_atenciones;

CREATE TRIGGER trg_sync_customer_atencion_management_last_activity
  BEFORE INSERT OR UPDATE OF active_management_employee_id,
    active_management_started_at,
    active_management_last_activity_at
  ON public.customer_atenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_atencion_management_last_activity();

-- Backfill existing locks
UPDATE public.customer_atenciones
SET active_management_last_activity_at = COALESCE(
  active_management_last_activity_at,
  active_management_started_at,
  updated_at,
  now()
)
WHERE active_management_employee_id IS NOT NULL
  AND active_management_last_activity_at IS NULL;

-- ---------------------------------------------------------------------------
-- Event vocabulary: inactivity release audit
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
      'gestion_liberada_por_inactividad'
    )
  );

-- ---------------------------------------------------------------------------
-- Internal helper: release one expired lock (expects row locked FOR UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_expired_customer_atencion_management_row(
  p_atencion public.customer_atenciones
)
RETURNS public.customer_atenciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restore_status text;
  v_manager_id uuid;
  v_previous_status text;
  v_previous_next_step text;
  v_last_activity timestamptz;
  v_timeout_minutes integer;
BEGIN
  IF p_atencion.status IS DISTINCT FROM 'en_gestion'
     OR p_atencion.active_management_employee_id IS NULL THEN
    RETURN p_atencion;
  END IF;

  v_timeout_minutes := public.customer_atencion_management_lock_timeout_minutes();
  v_last_activity := COALESCE(
    p_atencion.active_management_last_activity_at,
    p_atencion.active_management_started_at
  );

  IF v_last_activity IS NULL
     OR v_last_activity > (now() - make_interval(mins => v_timeout_minutes)) THEN
    RETURN p_atencion;
  END IF;

  v_manager_id := p_atencion.active_management_employee_id;
  v_previous_status := p_atencion.status;
  v_previous_next_step := p_atencion.next_step;

  SELECT e.previous_status
  INTO v_restore_status
  FROM public.customer_atencion_events e
  WHERE e.customer_atencion_id = p_atencion.id
    AND e.company_id = p_atencion.company_id
    AND e.employee_id = v_manager_id
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
    active_management_last_activity_at = NULL,
    updated_at = now()
  WHERE ca.id = p_atencion.id
    AND ca.company_id = p_atencion.company_id
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
    p_atencion.company_id,
    p_atencion.id,
    v_manager_id,
    'gestion_liberada_por_inactividad',
    'Gestión liberada automáticamente por inactividad (' || v_timeout_minutes::text || ' min).',
    v_previous_status,
    v_restore_status,
    v_previous_next_step,
    p_atencion.next_step
  );

  SELECT *
  INTO p_atencion
  FROM public.customer_atenciones ca
  WHERE ca.id = p_atencion.id
    AND ca.company_id = p_atencion.company_id
    AND ca.deleted_at IS NULL;

  RETURN p_atencion;
END;
$$;

-- ---------------------------------------------------------------------------
-- Batch release for a company (lazy cleanup on inbox refresh / cron-ready)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_expired_customer_atencion_managements(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.customer_atenciones%ROWTYPE;
  v_released integer := 0;
  v_timeout_minutes integer;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: company_id obligatorio.';
  END IF;

  v_timeout_minutes := public.customer_atencion_management_lock_timeout_minutes();

  FOR v_row IN
    SELECT *
    FROM public.customer_atenciones ca
    WHERE ca.company_id = p_company_id
      AND ca.deleted_at IS NULL
      AND ca.status = 'en_gestion'
      AND ca.active_management_employee_id IS NOT NULL
      AND COALESCE(
        ca.active_management_last_activity_at,
        ca.active_management_started_at
      ) <= (now() - make_interval(mins => v_timeout_minutes))
    FOR UPDATE
  LOOP
    PERFORM public.release_expired_customer_atencion_management_row(v_row);
    v_released := v_released + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'released_count', v_released,
    'timeout_minutes', v_timeout_minutes
  );
END;
$$;

COMMENT ON FUNCTION public.release_expired_customer_atencion_managements(uuid) IS
  'RC 3.2.5 — release en_gestion locks idle beyond the configured timeout.';

REVOKE ALL ON FUNCTION public.release_expired_customer_atencion_managements(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_expired_customer_atencion_managements(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_expired_customer_atencion_managements(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_customer_atencion_managements(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Heartbeat / touch last activity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_customer_atencion_management_activity(
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
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros incompletos para actualizar actividad.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'DEMO_READ_ONLY: La plataforma de demostración es de solo lectura.';
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

  -- Expire first if stale, then reject if no longer owned.
  v_atencion := public.release_expired_customer_atencion_management_row(v_atencion);

  IF v_atencion.status <> 'en_gestion'
     OR v_atencion.active_management_employee_id IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH: Solo quien gestiona actualmente puede registrar actividad.';
  END IF;

  UPDATE public.customer_atenciones ca
  SET
    active_management_last_activity_at = now(),
    updated_at = now()
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', 'en_gestion',
    'new_status', 'en_gestion',
    'previous_next_step', v_atencion.next_step,
    'new_next_step', v_atencion.next_step,
    'idempotent', true
  );
END;
$$;

COMMENT ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) IS
  'RC 3.2.5 — heartbeat for the operator holding en_gestion.';

REVOKE ALL ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- start_management: expire stale lock, set last_activity, enrich lock error
-- ---------------------------------------------------------------------------
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
  v_started_at text;
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

  -- RC 3.2.5 — release expired lock before ownership checks
  v_atencion := public.release_expired_customer_atencion_management_row(v_atencion);

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  IF v_atencion.status = 'en_gestion' THEN
    IF v_atencion.active_management_employee_id = p_employee_id THEN
      UPDATE public.customer_atenciones ca
      SET
        active_management_last_activity_at = now(),
        updated_at = now()
      WHERE ca.id = p_atencion_id
        AND ca.company_id = p_company_id
        AND ca.deleted_at IS NULL;

      RETURN jsonb_build_object(
        'atencion_id', v_atencion.id,
        'previous_status', v_previous_status,
        'new_status', v_atencion.status,
        'previous_next_step', v_previous_next_step,
        'new_next_step', v_atencion.next_step,
        'idempotent', true
      );
    END IF;

    v_started_at := COALESCE(
      to_char(v_atencion.active_management_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      ''
    );

    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_ALREADY_IN_MANAGEMENT: Esta Consulta ya está siendo gestionada por otra persona.|manager_employee_id='
        || COALESCE(v_atencion.active_management_employee_id::text, '')
        || '|started_at='
        || v_started_at;
  END IF;

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
    active_management_last_activity_at = now(),
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
  'RC 3.2.5 — start management with exclusive lock, activity stamp, and stale-lock release.';

-- ---------------------------------------------------------------------------
-- cancel: also clear last_activity
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

  IF v_atencion.status <> 'en_gestion'
     OR v_atencion.active_management_employee_id IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH: Solo quien gestiona actualmente la Consulta puede cancelar la gestión.';
  END IF;

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

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
    active_management_last_activity_at = NULL,
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
  'RC 3.2.3/3.2.5 — release en_gestion without historial; clears lock activity.';
