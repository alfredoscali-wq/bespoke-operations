-- Sprint 3 — SET search_path = public on Group 3 ISP RPC / materials internals.
-- Does not change SECURITY, arguments, or function bodies.
-- Excludes: Sprint 1/2 functions, Group 4 updated_at, non-ISP/materials utilities.

ALTER FUNCTION public.apply_material_stock_reservation_delta(uuid, uuid, uuid, numeric)
  SET search_path = public;

ALTER FUNCTION public.create_isp_onboarding(jsonb)
  SET search_path = public;

ALTER FUNCTION public.create_isp_onboarding_core(jsonb)
  SET search_path = public;

ALTER FUNCTION public.create_isp_service_connection(jsonb)
  SET search_path = public;

ALTER FUNCTION public.create_isp_subscriber_service(jsonb)
  SET search_path = public;

ALTER FUNCTION public.ensure_isp_subscriber(uuid, uuid, text)
  SET search_path = public;

ALTER FUNCTION public.ensure_material_stock_level(uuid, uuid, uuid)
  SET search_path = public;

ALTER FUNCTION public.format_isp_billing_document_number(integer, integer)
  SET search_path = public;

ALTER FUNCTION public.import_isp_migration(uuid, boolean)
  SET search_path = public;

ALTER FUNCTION public.import_isp_migration_core(uuid, boolean)
  SET search_path = public;

ALTER FUNCTION public.isp_apply_activation_commercial_status()
  SET search_path = public;

ALTER FUNCTION public.isp_commercial_status_from_activation(date)
  SET search_path = public;

ALTER FUNCTION public.isp_create_connection_on_service(uuid, jsonb)
  SET search_path = public;

ALTER FUNCTION public.isp_keep_text(text, text)
  SET search_path = public;

ALTER FUNCTION public.isp_services_ensure_subscriber()
  SET search_path = public;

ALTER FUNCTION public.lock_material_stock_level(uuid, uuid, uuid)
  SET search_path = public;

ALTER FUNCTION public.materials_consumed_exceeds_reserved_message(numeric, numeric, text)
  SET search_path = public;

ALTER FUNCTION public.materials_insufficient_stock_message(numeric, numeric)
  SET search_path = public;

ALTER FUNCTION public.materials_net_available(numeric, numeric)
  SET search_path = public;

ALTER FUNCTION public.materials_validate_consumed_quantity(text, numeric, numeric)
  SET search_path = public;

ALTER FUNCTION public.next_isp_customer_number(uuid)
  SET search_path = public;

ALTER FUNCTION public.release_task_material_line_internal(uuid, boolean)
  SET search_path = public;

ALTER FUNCTION public.reserve_task_material_line_internal(uuid)
  SET search_path = public;

ALTER FUNCTION public.task_has_active_catalog_material_lines(uuid)
  SET search_path = public;

ALTER FUNCTION public.task_has_reserved_catalog_material_lines(uuid)
  SET search_path = public;

ALTER FUNCTION public.task_has_reserved_material_lines(uuid)
  SET search_path = public;

ALTER FUNCTION public.task_should_immediately_reserve_material(uuid)
  SET search_path = public;

ALTER FUNCTION public.update_isp_connection(jsonb)
  SET search_path = public;

ALTER FUNCTION public.update_isp_contracted_service(jsonb)
  SET search_path = public;
