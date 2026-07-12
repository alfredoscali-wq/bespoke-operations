-- Hotfix — Authoritative soft delete for task reference photos (bypasses client RLS).
--
-- Context:
--   Client UPDATE on task_photos can still fail under tenant RLS even after
--   20261008000100_task_photos_soft_delete_rls.sql (company_id drift, policy drift).
--   Admin operations use SECURITY DEFINER RPC + service_role, same as OT dispatch.
--
-- Scope:
--   photo_type = reference only
--   task.status = programada only
--   tenant isolation via tasks.company_id

CREATE OR REPLACE FUNCTION public.soft_delete_task_reference_photo(
  p_company_id uuid,
  p_task_id uuid,
  p_photo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_company_id IS NULL OR p_task_id IS NULL OR p_photo_id IS NULL THEN
    RAISE EXCEPTION 'TASK_REFERENCE_PHOTO_INVALID_PARAMETERS'
      USING ERRCODE = 'invalid_parameter_value',
            MESSAGE = 'Parametros obligatorios incompletos para eliminar la fotografia.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'La plataforma de demostracion es de solo lectura.';
  END IF;

  UPDATE public.task_photos tp
  SET deleted_at = now()
  FROM public.tasks t
  WHERE tp.id = p_photo_id
    AND tp.task_id = p_task_id
    AND t.id = tp.task_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL
    AND t.status = 'programada'
    AND tp.photo_type = 'reference'
    AND tp.deleted_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'TASK_REFERENCE_PHOTO_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation',
            MESSAGE = 'No se encontro la fotografia de referencia o la OT no admite esta accion.';
  END IF;

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'photo_id', p_photo_id,
    'deleted', true
  );
END;
$$;

COMMENT ON FUNCTION public.soft_delete_task_reference_photo(uuid, uuid, uuid) IS
  'Soft-deletes a reference photo for a programada work order within the tenant. service_role only.';

REVOKE ALL ON FUNCTION public.soft_delete_task_reference_photo(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_task_reference_photo(uuid, uuid, uuid) TO service_role;
