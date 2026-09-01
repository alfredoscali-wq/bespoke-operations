-- SERVICIOS — physical DELETE of unused isp_service_catalog rows.
-- Used catalog items stay: deactivate via is_active. Do not cascade deletes.
-- Existing FKs remain RESTRICT (isp_services.catalog_id, tasks.service_catalog_id).
-- TV component FK stays ON DELETE SET NULL; a BEFORE DELETE trigger blocks
-- deleting a TV plan that commercial services still reference as tv_plan_catalog_id.

CREATE OR REPLACE FUNCTION public.prevent_isp_catalog_delete_when_tv_component_referenced()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.isp_service_catalog AS commercial
    WHERE commercial.tv_plan_catalog_id = OLD.id
      AND commercial.id IS DISTINCT FROM OLD.id
  ) THEN
    RAISE EXCEPTION 'Este servicio está siendo utilizado y no puede eliminarse.'
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_isp_catalog_delete_tv_component
  ON public.isp_service_catalog;

CREATE TRIGGER trg_prevent_isp_catalog_delete_tv_component
  BEFORE DELETE ON public.isp_service_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_isp_catalog_delete_when_tv_component_referenced();

DROP POLICY IF EXISTS isp_service_catalog_delete_policy ON public.isp_service_catalog;
CREATE POLICY isp_service_catalog_delete_policy
  ON public.isp_service_catalog
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND (
      public.auth_user_has_allowed_module('clientes_360')
      OR (
        public.auth_user_has_allowed_module('subscriptions')
        AND category = 'tv'
      )
    )
  );

GRANT DELETE ON public.isp_service_catalog TO authenticated;
