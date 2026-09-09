-- Sprint 4 — SET search_path = public on remaining updated_at triggers and utilities.
-- Does not change SECURITY, arguments, volatility, or function bodies.
-- Excludes: Sprint 1/2/3 functions (already have search_path), including
-- public.isp_commercial_status_from_activation (fixed in Sprint 3).

ALTER FUNCTION public.customer_atencion_management_lock_timeout_minutes()
  SET search_path = public;

ALTER FUNCTION public.is_allowed_task_status_transition(task_status, task_status)
  SET search_path = public;

ALTER FUNCTION public.is_valid_ar_cuit(text)
  SET search_path = public;

ALTER FUNCTION public.set_activity_events_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_activities_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_commitments_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_etiquetas_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_opportunities_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_people_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_solicitud_type_defs_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_solicitudes_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_territorial_activities_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_commercial_territorial_activity_types_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_companies_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_company_roles_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_contractors_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_crew_members_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_crews_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_customer_atenciones_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_customer_recuperaciones_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_customer_retenciones_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_customer_seguimientos_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_customers_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_employee_availability_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_employee_types_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_employees_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_evidences_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_incident_types_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_isp_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_materials_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_mobile_devices_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_network_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_operational_motivos_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_projects_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_subscription_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_task_daily_allocations_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_task_incidents_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_task_photos_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_tasks_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_treasury_movements_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_treasury_ot_renditions_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_work_order_type_checklist_items_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_work_order_type_incident_types_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_work_team_shifts_updated_at()
  SET search_path = public;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public;
