-- OBRAS OPS 1.0 — Despacho operativo al iniciar Obra
--
-- 1) Permite INSERT de tasks en status 'asignada' cuando project_id IS NOT NULL
--    SOLO si la Obra pertenece al mismo tenant, no está eliminada y está active.
-- 2) Valida coherencia multi-tenant crew↔tarea cuando project_id IS NOT NULL.
-- 3) RPC atómica start_project_operational_dispatch:
--    planned → active + programada → asignada (mismas company_id).
--
-- Demo read-only autoritativo: requireWritablePlatformSession en la API
-- (el check dentro de la RPC puede ser ineficaz bajo service_role).
--
-- NO ejecutar automáticamente: aplicar manualmente en Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. INSERT: tareas de Obra pueden nacer asignada (con integridad tenant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_task_status_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Obras OPS 1.0 hardening: crew del mismo tenant en tareas de Obra.
    IF NEW.project_id IS NOT NULL AND NEW.crew_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.crews c
        WHERE c.id = NEW.crew_id
          AND c.company_id = NEW.company_id
          AND c.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'La cuadrilla no pertenece a la compañía de la tarea o está archivada.';
      END IF;
    END IF;

    IF NEW.status = 'asignada'::public.task_status
       AND NEW.project_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = NEW.project_id
          AND p.company_id = NEW.company_id
          AND p.deleted_at IS NULL
          AND p.status = 'active'::public.project_status
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'Solo se pueden crear tareas asignadas en una obra activa del mismo tenant.';
      END IF;

      RETURN NEW;
    END IF;

    IF NEW.status NOT IN (
      'programada'::public.task_status,
      'pendiente'::public.task_status
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Las órdenes de trabajo nuevas deben crearse en estado programada.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_allowed_task_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Transición de estado no permitida: %s → %s.',
        OLD.status,
        NEW.status
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_task_status_workflow() IS
  'Enforces task status workflow. INSERT asignada only for active same-tenant Obra tasks; crew tenant integrity for Obra inserts. OBRAS OPS 1.0.';

-- ---------------------------------------------------------------------------
-- 2. RPC: iniciar obra + despacho operativo atómico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_project_operational_dispatch(
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
  v_task_count integer := 0;
  v_missing_crew_codes text;
  v_missing_date_codes text;
  v_dispatched_count integer := 0;
  v_dispatched_ids uuid[];
  v_actor text := nullif(trim(COALESCE(p_actor_display_name, '')), '');
  v_history_description text;
BEGIN
  IF p_company_id IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'Parámetros obligatorios incompletos para iniciar la obra.';
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

  IF v_project.status IS DISTINCT FROM 'planned'::public.project_status THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Solo se puede iniciar una obra en estado Planificada.';
  END IF;

  SELECT count(*)::integer
  INTO v_task_count
  FROM public.tasks t
  WHERE t.project_id = p_project_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL;

  IF v_task_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'La obra no tiene tareas. Cree al menos una tarea antes de iniciarla.';
  END IF;

  SELECT string_agg(t.code, ', ' ORDER BY t.code)
  INTO v_missing_crew_codes
  FROM public.tasks t
  WHERE t.project_id = p_project_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL
    AND t.status = 'programada'::public.task_status
    AND t.crew_id IS NULL;

  IF v_missing_crew_codes IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Hay tareas sin cuadrilla asignada (%s). Asigne cuadrilla antes de iniciar la obra.',
        v_missing_crew_codes
      );
  END IF;

  SELECT string_agg(t.code, ', ' ORDER BY t.code)
  INTO v_missing_date_codes
  FROM public.tasks t
  WHERE t.project_id = p_project_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL
    AND t.status = 'programada'::public.task_status
    AND t.due_date IS NULL;

  IF v_missing_date_codes IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Hay tareas sin fecha operativa (%s). Defina la fecha antes de iniciar la obra.',
        v_missing_date_codes
      );
  END IF;

  UPDATE public.projects p
  SET
    status = 'active'::public.project_status,
    updated_at = now()
  WHERE p.id = p_project_id
    AND p.company_id = p_company_id
    AND p.deleted_at IS NULL;

  WITH promoted AS (
    UPDATE public.tasks t
    SET
      status = 'asignada'::public.task_status,
      -- Obras no usan Planificación: limpiar lane de planning si hubiera valor residual.
      execution_order = NULL,
      updated_at = now()
    WHERE t.project_id = p_project_id
      AND t.company_id = p_company_id
      AND t.deleted_at IS NULL
      AND t.status = 'programada'::public.task_status
      AND t.crew_id IS NOT NULL
      AND t.due_date IS NOT NULL
    RETURNING t.id
  )
  SELECT
    coalesce(array_agg(id), ARRAY[]::uuid[]),
    coalesce(count(*)::integer, 0)
  INTO v_dispatched_ids, v_dispatched_count
  FROM promoted;

  IF v_dispatched_count = 1 THEN
    v_history_description :=
      'Estado actualizado de Planificada a Activa. Despacho operativo: 1 tarea pasó a Asignada.';
  ELSIF v_dispatched_count > 1 THEN
    v_history_description := format(
      'Estado actualizado de Planificada a Activa. Despacho operativo: %s tareas pasaron a Asignada.',
      v_dispatched_count
    );
  ELSE
    v_history_description :=
      'Estado actualizado de Planificada a Activa. No había tareas programadas pendientes de despacho.';
  END IF;

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
      'previousStatus', 'planned',
      'nextStatus', 'active',
      'dispatchedCount', v_dispatched_count,
      'dispatchedTaskIds', to_jsonb(v_dispatched_ids)
    ),
    v_actor
  );

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'previous_status', 'planned',
    'next_status', 'active',
    'dispatched_count', v_dispatched_count,
    'dispatched_task_ids', to_jsonb(v_dispatched_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) IS
  'OBRAS OPS 1.0: atomically start a planned project and promote eligible programada tasks to asignada. service_role only.';

REVOKE ALL ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) TO service_role;
