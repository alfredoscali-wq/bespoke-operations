-- Hotfix — Allow task_photos soft delete under multi-tenant RLS.
--
-- Context:
--   20260735000100_task_photos_and_geolocation.sql created:
--     USING (deleted_at IS NULL)
--     WITH CHECK (deleted_at IS NULL)
--   That WITH CHECK rejects UPDATE when deleted_at becomes non-null (SQLSTATE 42501:
--   "new row violates row-level security policy for table task_photos").
--
--   20260914000100_critical_risks_sprint_c4_1.sql already scopes updates by tenant,
--   but deployments that never received the policy replacement still block soft delete.
--
-- This policy mirrors 20260916000100_fix_tasks_soft_delete_rls_multi_tenant.sql:
-- USING limits to active rows; WITH CHECK explicitly permits soft delete.

DROP POLICY IF EXISTS task_photos_update_policy ON public.task_photos;

CREATE POLICY task_photos_update_policy
  ON public.task_photos
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
  );

COMMENT ON POLICY task_photos_update_policy ON public.task_photos IS
  'Multi-tenant updates on active rows. USING limits to non-deleted rows; WITH CHECK explicitly permits soft delete (deleted_at may become non-null) within the tenant.';
