-- Align commercial_territorial_activity_counters RLS with
-- commercial_opportunity_counters. Counter rows are touched by the
-- assign_commercial_territorial_activity_code trigger as the inserting user
-- (SECURITY INVOKER); policies must allow authenticated module users.

ALTER TABLE public.commercial_territorial_activity_counters
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_territorial_activity_counters_select_policy
  ON public.commercial_territorial_activity_counters;
CREATE POLICY commercial_territorial_activity_counters_select_policy
  ON public.commercial_territorial_activity_counters
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

DROP POLICY IF EXISTS commercial_territorial_activity_counters_insert_policy
  ON public.commercial_territorial_activity_counters;
CREATE POLICY commercial_territorial_activity_counters_insert_policy
  ON public.commercial_territorial_activity_counters
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS commercial_territorial_activity_counters_update_policy
  ON public.commercial_territorial_activity_counters;
CREATE POLICY commercial_territorial_activity_counters_update_policy
  ON public.commercial_territorial_activity_counters
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );
