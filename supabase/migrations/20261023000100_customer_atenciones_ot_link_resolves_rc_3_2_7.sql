-- RC 3.2.7 — linking an OT closes the consultation in Atención al Cliente.
-- Follow-up / Operaciones continues on the work order; no redundant resolve event.

-- ---------------------------------------------------------------------------
-- Optional resolution audit columns (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS resolved_by_employee_id uuid;

COMMENT ON COLUMN public.customer_atenciones.resolved_at IS
  'RC 3.2.7 — when the consultation was closed in Atención (resolve or OT link).';
COMMENT ON COLUMN public.customer_atenciones.resolved_by_employee_id IS
  'RC 3.2.7 — employee who closed the consultation in Atención.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_atenciones_resolved_by_employee_id_fkey'
      AND conrelid = 'public.customer_atenciones'::regclass
  ) THEN
    ALTER TABLE public.customer_atenciones
      ADD CONSTRAINT customer_atenciones_resolved_by_employee_id_fkey
      FOREIGN KEY (resolved_by_employee_id)
      REFERENCES public.employees(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill: any consultation already linked to an OT is closed in Atención.
UPDATE public.customer_atenciones
SET
  status = 'resuelta',
  next_step = NULL,
  resultado = CASE
    WHEN resultado = 'requiere_seguimiento' THEN 'ot_creada'
    ELSE resultado
  END,
  follow_up_actions = COALESCE(
    (
      SELECT array_agg(action)
      FROM unnest(COALESCE(follow_up_actions, '{}'::text[])) AS action
      WHERE action IS DISTINCT FROM 'generar_ot'
    ),
    '{}'::text[]
  ),
  active_management_employee_id = NULL,
  active_management_started_at = NULL,
  active_management_last_activity_at = NULL,
  resolved_at = COALESCE(resolved_at, ot_linked_at, updated_at, now()),
  resolved_by_employee_id = COALESCE(
    resolved_by_employee_id,
    ot_linked_by_employee_id
  ),
  updated_at = now()
WHERE deleted_at IS NULL
  AND linked_task_id IS NOT NULL
  AND (
    status IS DISTINCT FROM 'resuelta'
    OR next_step IS NOT NULL
    OR 'generar_ot' = ANY (COALESCE(follow_up_actions, '{}'::text[]))
    OR resolved_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- link_customer_atencion_to_task — resolve on successful OT link
-- ---------------------------------------------------------------------------
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
  v_previous_status text;
  v_previous_next_step text;
  v_resolved_at timestamptz := now();
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

  v_previous_status := v_atencion.status;
  v_previous_next_step := v_atencion.next_step;

  v_follow_up := ARRAY(
    SELECT action
    FROM unnest(COALESCE(v_atencion.follow_up_actions, '{}'::text[])) AS action
    WHERE action IS DISTINCT FROM 'generar_ot'
  );

  UPDATE public.customer_atenciones ca
  SET
    linked_task_id = v_task.id,
    linked_task_code = COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    ot_linked_at = v_resolved_at,
    ot_linked_by_employee_id = p_employee_id,
    status = 'resuelta',
    next_step = NULL,
    resultado = CASE
      WHEN ca.resultado = 'requiere_seguimiento' THEN 'ot_creada'
      WHEN ca.resultado IS NULL OR ca.resultado = '' THEN 'ot_creada'
      ELSE ca.resultado
    END,
    follow_up_actions = v_follow_up,
    moroso_tracking_status = NULL,
    active_management_employee_id = NULL,
    active_management_started_at = NULL,
    active_management_last_activity_at = NULL,
    resolved_at = COALESCE(ca.resolved_at, v_resolved_at),
    resolved_by_employee_id = COALESCE(ca.resolved_by_employee_id, p_employee_id),
    updated_at = v_resolved_at
  WHERE ca.id = p_atencion_id
    AND ca.company_id = p_company_id
    AND ca.deleted_at IS NULL;

  -- Single historial event: OT link represents Atención closure (no consulta_resuelta).
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
    v_previous_status,
    'resuelta',
    v_previous_next_step,
    NULL
  );

  RETURN jsonb_build_object(
    'atencion_id', p_atencion_id,
    'linked_task_id', v_task.id,
    'linked_task_code', COALESCE(nullif(trim(v_task.code), ''), v_task.id::text),
    'ot_linked_at', v_resolved_at,
    'ot_linked_by_employee_id', p_employee_id,
    'status', 'resuelta',
    'resolved_at', v_resolved_at
  );
END;
$$;

COMMENT ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) IS
  'RC 3.2.7 — link OT and close consultation in Atención (status=resuelta); no extra resolve event.';

-- ---------------------------------------------------------------------------
-- link_customer_atencion_ot — same closure semantics
-- ---------------------------------------------------------------------------
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
BEGIN
  RETURN public.link_customer_atencion_to_task(
    p_company_id,
    p_atencion_id,
    p_employee_id,
    p_task_id
  );
END;
$$;

COMMENT ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) IS
  'RC 3.2.7 — alias of link_customer_atencion_to_task (OT link closes Atención).';

REVOKE ALL ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_atencion_to_task(uuid, uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_atencion_ot(uuid, uuid, uuid, uuid) TO service_role;
