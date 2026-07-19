-- RC 3.2.0 — optional post-resolution follow-up actions (e.g. generar OT)
-- Consultations remain resuelta with next_step NULL; follow-ups are separate.

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS follow_up_actions text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.customer_atenciones.follow_up_actions IS
  'RC 3.2.0 — optional actions after resolve (e.g. generar_ot). Not part of the consultation lifecycle / next_step.';

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_follow_up_actions_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_follow_up_actions_check CHECK (
    follow_up_actions <@ ARRAY['generar_ot']::text[]
  );

-- Resolve with optional follow-up actions (replaces 4-arg overload)
DROP FUNCTION IF EXISTS public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text);

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

COMMENT ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) IS
  'RC 3.2.0 — resolve consultation; optional follow_up_actions (e.g. generar_ot) without creating an OT.';

REVOKE ALL ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_customer_atencion_consultation(uuid, uuid, uuid, text, text[]) TO service_role;

-- Allow linking an OT when the consultation is resolved with follow-up generar_ot,
-- and clear that follow-up once linked. Does not create tasks.
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
