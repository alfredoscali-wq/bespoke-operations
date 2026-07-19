-- =============================================================================
-- DB 1.0 SCHEMA SYNC — customer_atenciones / Gestión de Consultas
-- =============================================================================
-- Forward-only corrective migration. Idempotent. Safe on populated and empty DBs.
-- Does NOT delete data or tables. Does NOT rewrite historical migrations.
--
-- Canonical RPC bodies sourced from:
--   RC 3.2.5  management lock (start/cancel/touch/release/helpers/trigger)
--   RC 3.2.0  resolve + follow_up + link_customer_atencion_ot
--   RC 3.2.6  link_customer_atencion_to_task
--   Sprint 2.9.1 hard_delete
--   20261013  defer + moroso (raise-message style)
-- =============================================================================

-- =============================================================================
-- 1. COLUMNAS
-- =============================================================================

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS linked_task_id uuid;

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS linked_task_code text;

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS ot_linked_at timestamptz;

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS ot_linked_by_employee_id uuid;

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS active_management_last_activity_at timestamptz;

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS follow_up_actions text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS moroso_tracking_status text;

COMMENT ON COLUMN public.customer_atenciones.linked_task_id IS
  'Optional linked work order (tasks.id) for generar_ot circuit; does not auto-close the consulta.';
COMMENT ON COLUMN public.customer_atenciones.linked_task_code IS
  'Denormalized OT code/number for display and audit.';
COMMENT ON COLUMN public.customer_atenciones.ot_linked_at IS
  'When the consulta was linked to an OT.';
COMMENT ON COLUMN public.customer_atenciones.ot_linked_by_employee_id IS
  'Employee who linked the OT to this consulta.';
COMMENT ON COLUMN public.customer_atenciones.active_management_last_activity_at IS
  'RC 3.2.5 — last operator activity while holding en_gestion; used for lock expiry.';
COMMENT ON COLUMN public.customer_atenciones.follow_up_actions IS
  'RC 3.2.0 — optional actions after resolve (e.g. generar_ot). Not part of the consultation lifecycle / next_step.';

-- Foreign keys (idempotent): add only when missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_atenciones_linked_task_id_fkey'
      AND conrelid = 'public.customer_atenciones'::regclass
  ) THEN
    ALTER TABLE public.customer_atenciones
      ADD CONSTRAINT customer_atenciones_linked_task_id_fkey
      FOREIGN KEY (linked_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_atenciones_ot_linked_by_employee_id_fkey'
      AND conrelid = 'public.customer_atenciones'::regclass
  ) THEN
    ALTER TABLE public.customer_atenciones
      ADD CONSTRAINT customer_atenciones_ot_linked_by_employee_id_fkey
      FOREIGN KEY (ot_linked_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill last_activity for open locks (no-op when already set)
UPDATE public.customer_atenciones
SET active_management_last_activity_at = COALESCE(
  active_management_last_activity_at,
  active_management_started_at,
  updated_at,
  now()
)
WHERE active_management_employee_id IS NOT NULL
  AND active_management_last_activity_at IS NULL;

-- =============================================================================
-- 2. ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS customer_atenciones_linked_task_id_idx
  ON public.customer_atenciones (company_id, linked_task_id)
  WHERE deleted_at IS NULL AND linked_task_id IS NOT NULL;

-- =============================================================================
-- 3. CONSTRAINTS
-- =============================================================================

-- 3.1 action_type — final vocabulary (never narrower than app + live data)
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

-- 3.2 next_step — Sprint 2.8 / hotfix vocabulary
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

-- 3.3 motivo — RC 3.1.6
ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_motivo_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_motivo_check CHECK (
    motivo IN (
      'problema_tecnico',
      'facturacion',
      'cambio_plan_tecnologia',
      'consulta_comercial',
      'consulta_tv',
      'nuevo_servicio',
      'baja',
      'otro'
    )
  );

-- 3.4 follow_up_actions — RC 3.2.0
ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_follow_up_actions_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_follow_up_actions_check CHECK (
    follow_up_actions <@ ARRAY['generar_ot']::text[]
  );

-- 3.5 moroso_tracking_status — Sprint 2.6
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

-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

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

-- =============================================================================
-- 5. FUNCIONES RPC
-- =============================================================================

-- Drop obsolete resolve overload (4-arg) if still present
DROP FUNCTION IF EXISTS public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text);

-- Drop obsolete defer overload (4-arg) if still present
DROP FUNCTION IF EXISTS public.defer_customer_atencion_consultation(uuid, uuid, uuid, text);

-- --- helpers / lock ---
CREATE OR REPLACE FUNCTION public.customer_atencion_management_lock_timeout_minutes()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 15;
$$;

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

-- --- resolve / defer / moroso / link / hard-delete ---
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
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'previous_status', v_previous_status,
    'new_status', 'resuelta',
    'previous_next_step', v_previous_next_step,
    'new_next_step', NULL,
    'follow_up_actions', to_jsonb(v_follow_up)
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

COMMENT ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text, text) IS
  'Sprint 2.4/2.8 — atomically defer/continue-after an in-management Consulta; optional p_detail.';

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

COMMENT ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) IS
  'Sprint 2.6/2.8 — update moroso tracking status for derivar_admin_morosos consultations.';

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

CREATE OR REPLACE FUNCTION public.link_customer_atencion_ot(
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
    'OT vinculada: ' || COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    v_atencion.status,
    v_atencion.status,
    v_atencion.next_step,
    v_atencion.next_step
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'task_id', v_task.id,
    'task_code', COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    'ot_linked_at', now(),
    'ot_linked_by_employee_id', p_employee_id
  );
END;
$$;

COMMENT ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) IS
  'RC 3.2.0 — link OT when follow-up generar_ot is pending; clears that follow-up.';

CREATE OR REPLACE FUNCTION public.hard_delete_customer_atencion_consultation(
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
  v_deleted_events integer := 0;
  v_cleared_seguimientos integer := 0;
  v_deleted_atenciones integer := 0;
BEGIN
  IF p_company_id IS NULL OR p_atencion_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONSULTATION_INVALID_PARAMETERS: Parámetros incompletos para eliminar la consulta.';
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
      AND e.deleted_at IS NULL
      AND e.system_role = 'administrador'::public.system_role
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'CONSULTATION_DELETE_ADMIN_REQUIRED: Solo un Administrador puede eliminar consultas.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_atenciones ca
    WHERE ca.id = p_atencion_id
      AND ca.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'no_data_found',
      MESSAGE = 'CONSULTATION_NOT_FOUND: Consulta no encontrada.';
  END IF;

  DELETE FROM public.customer_atencion_events e
  WHERE e.customer_atencion_id = p_atencion_id
    AND e.company_id = p_company_id;
  GET DIAGNOSTICS v_deleted_events = ROW_COUNT;

  UPDATE public.customer_seguimientos s
  SET source_atencion_id = NULL
  WHERE s.source_atencion_id = p_atencion_id
    AND s.company_id = p_company_id;
  GET DIAGNOSTICS v_cleared_seguimientos = ROW_COUNT;

  DELETE FROM public.customer_atenciones ca
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id;
  GET DIAGNOSTICS v_deleted_atenciones = ROW_COUNT;

  IF v_deleted_atenciones = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'no_data_found',
      MESSAGE = 'CONSULTATION_NOT_FOUND: Consulta no encontrada.';
  END IF;

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'deleted_events', v_deleted_events,
    'cleared_seguimientos', v_cleared_seguimientos
  );
END;
$$;

-- =============================================================================
-- 6. GRANTS
-- =============================================================================

REVOKE ALL ON FUNCTION public.customer_atencion_management_lock_timeout_minutes() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.release_expired_customer_atencion_managements(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_expired_customer_atencion_managements(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_expired_customer_atencion_managements(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_customer_atencion_managements(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.touch_customer_atencion_management_activity(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.start_customer_atencion_management(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_customer_atencion_management(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) TO service_role;

REVOKE ALL ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.defer_customer_atencion_consultation(uuid, uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_atencion_moroso_tracking(uuid, uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid) TO service_role;

-- =============================================================================
-- 7. VALIDACIONES
-- =============================================================================

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  -- Columns required by React / inbox
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_atenciones' AND column_name = 'linked_task_id'
  ) THEN v_missing := array_append(v_missing, 'column:linked_task_id'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_atenciones' AND column_name = 'linked_task_code'
  ) THEN v_missing := array_append(v_missing, 'column:linked_task_code'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_atenciones' AND column_name = 'ot_linked_at'
  ) THEN v_missing := array_append(v_missing, 'column:ot_linked_at'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_atenciones' AND column_name = 'ot_linked_by_employee_id'
  ) THEN v_missing := array_append(v_missing, 'column:ot_linked_by_employee_id'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_atenciones' AND column_name = 'follow_up_actions'
  ) THEN v_missing := array_append(v_missing, 'column:follow_up_actions'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_atenciones' AND column_name = 'active_management_last_activity_at'
  ) THEN v_missing := array_append(v_missing, 'column:active_management_last_activity_at'); END IF;

  -- RPCs
  IF to_regprocedure('public.start_customer_atencion_management(uuid,uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:start_customer_atencion_management');
  END IF;
  IF to_regprocedure('public.cancel_customer_atencion_management(uuid,uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:cancel_customer_atencion_management');
  END IF;
  IF to_regprocedure('public.touch_customer_atencion_management_activity(uuid,uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:touch_customer_atencion_management_activity');
  END IF;
  IF to_regprocedure('public.release_expired_customer_atencion_managements(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:release_expired_customer_atencion_managements');
  END IF;
  IF to_regprocedure('public.resolve_customer_atencion_consultation(uuid,uuid,uuid,text,text[])') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:resolve_customer_atencion_consultation');
  END IF;
  IF to_regprocedure('public.defer_customer_atencion_consultation(uuid,uuid,uuid,text,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:defer_customer_atencion_consultation');
  END IF;
  IF to_regprocedure('public.link_customer_atencion_to_task(uuid,uuid,uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:link_customer_atencion_to_task');
  END IF;
  IF to_regprocedure('public.link_customer_atencion_ot(uuid,uuid,uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:link_customer_atencion_ot');
  END IF;
  IF to_regprocedure('public.hard_delete_customer_atencion_consultation(uuid,uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:hard_delete_customer_atencion_consultation');
  END IF;
  IF to_regprocedure('public.update_customer_atencion_moroso_tracking(uuid,uuid,uuid,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'rpc:update_customer_atencion_moroso_tracking');
  END IF;

  -- CHECKs
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_atencion_events_action_type_check'
      AND conrelid = 'public.customer_atencion_events'::regclass
  ) THEN
    v_missing := array_append(v_missing, 'check:action_type');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'DB_1_0_SCHEMA_SYNC_VALIDATION_FAILED: %', array_to_string(v_missing, ', ');
  END IF;
END $$;
