-- Sprint 2.9.1: hard-delete customer consultation (Administrador only).
-- Removes the consultation and all customer_atencion_events in one transaction.
-- Nullifies customer_seguimientos.source_atencion_id to avoid orphan FK references.
-- Callable only via service_role; actor must be system_role = administrador.

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

COMMENT ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid) IS
  'Hard-deletes a customer consultation and its events. Admin actor only. service_role.';

REVOKE ALL ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid)
  FROM anon;
REVOKE EXECUTE ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_customer_atencion_consultation(uuid, uuid, uuid)
  TO service_role;
