-- Sprint 2 — SET search_path = public on Group 2 integrity / tenant functions.
-- Does not change SECURITY, arguments, or function bodies.
-- Excludes: auth_can_manage_isp_migration, ISP/material RPCs, updated_at triggers, utilities.

ALTER FUNCTION public.assert_material_reservation_entities(uuid, uuid, uuid)
  SET search_path = public;

ALTER FUNCTION public.assign_commercial_opportunity_code()
  SET search_path = public;

ALTER FUNCTION public.assign_commercial_solicitud_code()
  SET search_path = public;

ALTER FUNCTION public.assign_commercial_territorial_activity_code()
  SET search_path = public;

ALTER FUNCTION public.enforce_activity_events_tenant_integrity()
  SET search_path = public;

ALTER FUNCTION public.enforce_customer_atencion_events_tenant_integrity()
  SET search_path = public;

ALTER FUNCTION public.enforce_customer_atenciones_tenant_integrity()
  SET search_path = public;

ALTER FUNCTION public.enforce_customer_recuperaciones_tenant_integrity()
  SET search_path = public;

ALTER FUNCTION public.enforce_customer_retenciones_assignment_immutability()
  SET search_path = public;

ALTER FUNCTION public.enforce_customer_retenciones_tenant_integrity()
  SET search_path = public;

ALTER FUNCTION public.enforce_customer_retenciones_workflow_transitions()
  SET search_path = public;

ALTER FUNCTION public.enforce_customer_seguimientos_tenant_integrity()
  SET search_path = public;

ALTER FUNCTION public.enforce_employees_employee_type_tenant_integrity()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_billing_document_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_billing_document_item_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_billing_run_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_billing_run_item_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_billing_sequence_lock()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_catalog_allowed_connection_types()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_catalog_technical_profile_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_connection_service_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_connection_technical_profile_company()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_service_catalog_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_service_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_isp_subscriber_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_material_movement_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_material_stock_level_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_agent_site_company()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_device_status_events_tenant()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_device_status_tenant()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_device_tenant()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_interface_status_tenant()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_interface_tenant()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_job_agent_company()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_link_tenant()
  SET search_path = public;

ALTER FUNCTION public.enforce_network_target_tenant()
  SET search_path = public;

ALTER FUNCTION public.enforce_one_active_tv_service()
  SET search_path = public;

ALTER FUNCTION public.enforce_task_material_line_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_task_service_catalog_company_match()
  SET search_path = public;

ALTER FUNCTION public.enforce_task_status_workflow()
  SET search_path = public;

ALTER FUNCTION public.prevent_employee_types_code_change()
  SET search_path = public;

ALTER FUNCTION public.set_task_completion_timestamps()
  SET search_path = public;

ALTER FUNCTION public.sync_customer_atencion_management_last_activity()
  SET search_path = public;
