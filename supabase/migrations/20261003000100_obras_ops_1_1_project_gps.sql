-- OBRAS OPS 1.1 — GPS único de Obra
--
-- 1) projects.latitude / projects.longitude (nullable, parity + range checks)
-- 2) start_project_operational_dispatch exige GPS antes de planned → active
--
-- NO modificar migraciones ya aplicadas.
-- NO ejecutar automáticamente: aplicar manualmente en Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Columnas GPS en projects
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7);

COMMENT ON COLUMN public.projects.latitude IS
  'GPS operativo único de la Obra. Fuente de verdad para inicio Field Agent de tareas con project_id. OBRAS OPS 1.1.';

COMMENT ON COLUMN public.projects.longitude IS
  'GPS operativo único de la Obra. Fuente de verdad para inicio Field Agent de tareas con project_id. OBRAS OPS 1.1.';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_gps_pair_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_gps_pair_check
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  );

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_latitude_range_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_latitude_range_check
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_longitude_range_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_longitude_range_check
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- ---------------------------------------------------------------------------
-- 2. RPC: Iniciar Obra requiere GPS (mantiene hardening Obras Ops 1.0)
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

  -- OBRAS OPS 1.1: GPS obligatorio para iniciar.
  IF v_project.latitude IS NULL OR v_project.longitude IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'La Obra necesita una ubicación GPS antes de poder iniciarse.';
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
  'OBRAS OPS 1.0/1.1: atomically start planned project with GPS required, promote programada→asignada. service_role only.';

REVOKE ALL ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.start_project_operational_dispatch(uuid, uuid, text) TO service_role;
