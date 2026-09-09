-- Sprint Security 6.1 — restrict EXECUTE on Group A SECURITY DEFINER functions.
-- ACL only: REVOKE PUBLIC/anon/authenticated, GRANT service_role.
-- Does not change function bodies, SECURITY, search_path, RLS, policies, or triggers.

REVOKE ALL ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamp with time zone
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamp with time zone
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamp with time zone
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_atencion_interaction(
  uuid, uuid, uuid, text, text, text, timestamp with time zone
) TO service_role;

REVOKE ALL ON FUNCTION public.soft_delete_task_reference_photo(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_task_reference_photo(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_task_reference_photo(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_task_reference_photo(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_customer_atencion_management_session_end(
  public.customer_atenciones, uuid
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_customer_atencion_management_session_end(
  public.customer_atenciones, uuid
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_customer_atencion_management_session_end(
  public.customer_atenciones, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_customer_atencion_management_session_end(
  public.customer_atenciones, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.release_expired_customer_atencion_management_row(
  public.customer_atenciones
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_expired_customer_atencion_management_row(
  public.customer_atenciones
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_expired_customer_atencion_management_row(
  public.customer_atenciones
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_customer_atencion_management_row(
  public.customer_atenciones
) TO service_role;
