-- Sprint Security 6.2 — revoke EXECUTE from anon on remaining SECURITY DEFINER functions.
-- Does not change authenticated, service_role, postgres, PUBLIC, bodies, or search_path.

REVOKE EXECUTE ON FUNCTION public.auth_can_access_task_material_lines() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_assign_customer_retencion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_create_customer_retencion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_commercial_etiquetas() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_commercial_solicitud_types() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_commercial_territorial_activity_types() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_company_roles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_employee_types() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_incident_types() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_materials() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_operational_motivos() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_task_incident(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_work_order_type_checklist() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_read_task_incident(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_can_read_task_material_lines() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_is_administrador() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_is_demo_platform_read_only() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_is_supervisor_or_administrador() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_operario_can_access_task(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_operario_is_assigned_to_task_crew(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_allowed_modules() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_employee_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_has_allowed_module(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_role_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_system_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_work_order_idempotent(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crew_member_belongs_to_user_company(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.customer_atenciones_record_consulta_creada_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_isp_catalog_tv_plan_component() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_treasury_ot_rendition_for_task(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_tasks_material_finalize_guard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_tasks_material_reservations() FROM anon;
