-- OBRAS OPS 1.2 — Cierre operativo autoritativo de Obra
--
-- RPC finalize_project_operational:
--   active|paused → closed, bloqueando si existen OT abiertas del mismo tenant.
--
-- Demo read-only autoritativo: requireWritablePlatformSession en la API
-- (el check dentro de la RPC puede ser ineficaz bajo service_role).
--
-- NO ejecutar automáticamente: aplicar manualmente en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.finalize_project_operational(
  p_company_id uuid,
  p_project_id uuid,
  p_actor_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_open_task_count integer := 0;
  v_actor text := nullif(trim(COALESCE(p_actor_display_name, '')), '');
  v_previous_status public.project_status;
  v_history_description text;
  v_previous_status_label text;
BEGIN
  IF p_company_id IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'Parámetros obligatorios incompletos para finalizar la obra.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'La plataforma de demostración es de solo lectura.';
  END IF;

  SELECT *
  INTO v_project
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.company_id = p_company_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Obra no encontrada.';
  END IF;

  v_previous_status := v_project.status;

  IF v_previous_status NOT IN (
    'active'::public.project_status,
    'paused'::public.project_status
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Solo se puede finalizar una obra en estado Activa o Pausada.';
  END IF;

  SELECT count(*)::integer
  INTO v_open_task_count
  FROM public.tasks t
  WHERE t.project_id = p_project_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL
    AND t.status IN (
      'programada'::public.task_status,
      'asignada'::public.task_status,
      'vencida'::public.task_status,
      'en-curso'::public.task_status,
      'incidencia'::public.task_status,
      'pendiente-cierre'::public.task_status,
      'en-aprobacion'::public.task_status,
      'pendiente'::public.task_status
    );

  IF v_open_task_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'No se puede finalizar la Obra mientras existan órdenes de trabajo abiertas (%s pendientes).',
        v_open_task_count
      );
  END IF;

  UPDATE public.projects p
  SET
    status = 'closed'::public.project_status,
    updated_at = now()
  WHERE p.id = p_project_id
    AND p.company_id = p_company_id
    AND p.deleted_at IS NULL;

  v_previous_status_label := CASE v_previous_status
    WHEN 'active'::public.project_status THEN 'Activa'
    WHEN 'paused'::public.project_status THEN 'Pausada'
    ELSE v_previous_status::text
  END;

  v_history_description := format(
    'Estado actualizado de %s a Finalizada.',
    v_previous_status_label
  );

  INSERT INTO public.project_history (
    company_id,
    project_id,
    event_type,
    title,
    description,
    metadata,
    created_by
  )
  VALUES (
    p_company_id,
    p_project_id,
    'status_changed',
    'Cambio de estado',
    v_history_description,
    jsonb_build_object(
      'previousStatus', v_previous_status::text,
      'nextStatus', 'closed',
      'openTaskCount', v_open_task_count
    ),
    v_actor
  );

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'previous_status', v_previous_status::text,
    'next_status', 'closed',
    'open_task_count', v_open_task_count
  );
END;
$$;

COMMENT ON FUNCTION public.finalize_project_operational(uuid, uuid, text) IS
  'OBRAS OPS 1.2: atomically finalize active/paused project when no open obra tasks remain. service_role only.';

REVOKE ALL ON FUNCTION public.finalize_project_operational(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_project_operational(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_project_operational(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_project_operational(uuid, uuid, text) TO service_role;
