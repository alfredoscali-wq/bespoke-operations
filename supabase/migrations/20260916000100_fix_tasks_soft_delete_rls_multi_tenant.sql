-- Sprint C1 follow-up — Allow tasks soft delete under multi-tenant RLS.
--
-- Context:
--   20260728000100_fix_tasks_soft_delete_rls.sql fixed soft delete with:
--     USING (deleted_at IS NULL)
--     WITH CHECK (true)
--   20260913000100_multi_tenant_rls_sprint_c1.sql replaced that policy with tenant
--   scoping but dropped the explicit soft-delete safeguard. Deployments that still
--   carry WITH CHECK (deleted_at IS NULL) from 20260614000000 reject UPDATE when
--   deleted_at becomes non-null (SQLSTATE 42501: new row violates row-level security).
--
-- This policy preserves Sprint C1 isolation (company_id + demo read-only) while
-- guaranteeing WITH CHECK never requires deleted_at IS NULL.

DROP POLICY IF EXISTS tasks_update_policy ON public.tasks;

CREATE POLICY tasks_update_policy
  ON public.tasks
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

COMMENT ON POLICY tasks_update_policy ON public.tasks IS
  'Multi-tenant updates on active rows. USING limits to non-deleted rows; WITH CHECK explicitly permits soft delete (deleted_at may become non-null) within the tenant.';
