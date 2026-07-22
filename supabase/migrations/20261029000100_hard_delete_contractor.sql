-- Hard-delete contractor (Administrador via service_role only).
-- Removes external crews, contractor users, and the contractor in one transaction.
-- Returns Auth user ids so the server can delete auth.users after the RPC commits.

CREATE OR REPLACE FUNCTION public.hard_delete_contractor(
  p_company_id uuid,
  p_contractor_id uuid,
  p_actor_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_legal_name text;
  v_crew_ids uuid[];
  v_employee_ids uuid[];
  v_app_user_ids uuid[];
  v_deleted_crews integer := 0;
  v_deleted_employees integer := 0;
  v_deleted_crew_members integer := 0;
  v_deleted_shifts integer := 0;
  v_deleted_contractors integer := 0;
BEGIN
  IF p_company_id IS NULL OR p_contractor_id IS NULL OR p_actor_employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'CONTRACTOR_INVALID_PARAMETERS: Parámetros incompletos para eliminar el contratista.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'DEMO_READ_ONLY: La plataforma de demostración es de solo lectura.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_actor_employee_id
      AND e.company_id = p_company_id
      AND e.deleted_at IS NULL
      AND e.system_role = 'administrador'::public.system_role
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'CONTRACTOR_DELETE_ADMIN_REQUIRED: Solo un Administrador puede eliminar definitivamente un contratista.';
  END IF;

  SELECT c.legal_name
  INTO v_legal_name
  FROM public.contractors c
  WHERE c.id = p_contractor_id
    AND c.company_id = p_company_id;

  IF v_legal_name IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'no_data_found',
      MESSAGE = 'CONTRACTOR_NOT_FOUND: Contratista no encontrado.';
  END IF;

  SELECT COALESCE(array_agg(cr.id), ARRAY[]::uuid[])
  INTO v_crew_ids
  FROM public.crews cr
  WHERE cr.contractor_id = p_contractor_id
    AND cr.company_id = p_company_id;

  SELECT
    COALESCE(array_agg(e.id), ARRAY[]::uuid[]),
    COALESCE(
      array_agg(e.app_user_id) FILTER (WHERE e.app_user_id IS NOT NULL),
      ARRAY[]::uuid[]
    )
  INTO v_employee_ids, v_app_user_ids
  FROM public.employees e
  WHERE e.contractor_id = p_contractor_id
    AND e.company_id = p_company_id;

  IF EXISTS (
    SELECT 1
    FROM public.task_incidents ti
    WHERE ti.employee_id = ANY (v_employee_ids)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'CONTRACTOR_HAS_OPERATIONAL_HISTORY: No se puede eliminar definitivamente: hay usuarios del contratista con incidencias registradas. Conserve el historial o archive el contratista.';
  END IF;

  IF cardinality(v_crew_ids) > 0 THEN
    DELETE FROM public.work_team_shifts wts
    WHERE wts.work_team_id = ANY (v_crew_ids);
    GET DIAGNOSTICS v_deleted_shifts = ROW_COUNT;

    UPDATE public.mobile_devices md
    SET work_team_id = NULL
    WHERE md.work_team_id = ANY (v_crew_ids);

    DELETE FROM public.crew_members cm
    WHERE cm.crew_id = ANY (v_crew_ids);
    GET DIAGNOSTICS v_deleted_crew_members = ROW_COUNT;
  END IF;

  IF cardinality(v_employee_ids) > 0 THEN
    DELETE FROM public.work_team_shifts wts
    WHERE wts.started_by = ANY (v_employee_ids);

    DELETE FROM public.employee_availability ea
    WHERE ea.employee_id = ANY (v_employee_ids);

    DELETE FROM public.crew_members cm
    WHERE cm.employee_id = ANY (v_employee_ids);

    UPDATE public.crews cr
    SET supervisor_employee_id = NULL
    WHERE cr.supervisor_employee_id = ANY (v_employee_ids);

    UPDATE public.activity_events ae
    SET employee_id = NULL
    WHERE ae.employee_id = ANY (v_employee_ids);

    DELETE FROM public.employees e
    WHERE e.id = ANY (v_employee_ids)
      AND e.company_id = p_company_id;
    GET DIAGNOSTICS v_deleted_employees = ROW_COUNT;
  END IF;

  IF cardinality(v_crew_ids) > 0 THEN
    DELETE FROM public.crews cr
    WHERE cr.id = ANY (v_crew_ids)
      AND cr.company_id = p_company_id;
    GET DIAGNOSTICS v_deleted_crews = ROW_COUNT;
  END IF;

  DELETE FROM public.contractors c
  WHERE c.id = p_contractor_id
    AND c.company_id = p_company_id;
  GET DIAGNOSTICS v_deleted_contractors = ROW_COUNT;

  IF v_deleted_contractors = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'no_data_found',
      MESSAGE = 'CONTRACTOR_NOT_FOUND: Contratista no encontrado.';
  END IF;

  RETURN jsonb_build_object(
    'contractor_id', p_contractor_id,
    'legal_name', v_legal_name,
    'deleted_crews', v_deleted_crews,
    'deleted_employees', v_deleted_employees,
    'deleted_crew_members', v_deleted_crew_members,
    'deleted_shifts', v_deleted_shifts,
    'app_user_ids', to_jsonb(COALESCE(v_app_user_ids, ARRAY[]::uuid[]))
  );
END;
$$;

COMMENT ON FUNCTION public.hard_delete_contractor(uuid, uuid, uuid) IS
  'Hard-deletes a contractor with external crews and users in one transaction. Admin actor only. service_role.';

REVOKE ALL ON FUNCTION public.hard_delete_contractor(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hard_delete_contractor(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hard_delete_contractor(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_contractor(uuid, uuid, uuid) TO service_role;
