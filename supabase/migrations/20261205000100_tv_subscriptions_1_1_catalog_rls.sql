-- TV & Suscripciones 1.1 — subscriptions module can administer TV catalog
-- rows in isp_service_catalog. Does not create a parallel TV table.
-- Does not change billing, SIRO, Excel or Clientes 360.

DROP POLICY IF EXISTS isp_service_catalog_insert_policy ON public.isp_service_catalog;
CREATE POLICY isp_service_catalog_insert_policy
  ON public.isp_service_catalog
  FOR INSERT
  WITH CHECK (
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

DROP POLICY IF EXISTS isp_service_catalog_update_policy ON public.isp_service_catalog;
CREATE POLICY isp_service_catalog_update_policy
  ON public.isp_service_catalog
  FOR UPDATE
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
  )
  WITH CHECK (
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
