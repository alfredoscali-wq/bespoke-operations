-- Sprint Security 5.0 — restrict EXECUTE on 5 critical SECURITY DEFINER functions.
-- ACL only: REVOKE PUBLIC/anon/authenticated, GRANT service_role.
-- Does not change function bodies, SECURITY, search_path, RLS, policies, or triggers.

REVOKE ALL ON FUNCTION public.seed_company_employee_types(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_company_employee_types(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_company_employee_types(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_company_employee_types(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.seed_default_operational_motivos(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_operational_motivos(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_default_operational_motivos(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_operational_motivos(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_task_material_lines_for_task_internal(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_task_material_lines_for_task_internal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_task_material_lines_for_task_internal(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_task_material_lines_for_task_internal(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.release_all_task_material_reservations_internal(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_all_task_material_reservations_internal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_all_task_material_reservations_internal(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_all_task_material_reservations_internal(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text,
  text, uuid, bigint, double precision, double precision, real
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text,
  text, uuid, bigint, double precision, double precision, real
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text,
  text, uuid, bigint, double precision, double precision, real
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text,
  text, uuid, bigint, double precision, double precision, real
) TO service_role;
