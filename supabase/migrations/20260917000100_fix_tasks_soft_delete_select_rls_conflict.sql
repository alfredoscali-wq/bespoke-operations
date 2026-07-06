-- Definitive fix — tasks soft delete vs tasks_select_policy (PostgREST / PostgreSQL RLS).
--
-- Root cause:
--   An UPDATE evaluated through PostgREST always includes a WHERE clause
--   (e.g. id=eq.<uuid>&deleted_at=is.null). Per PostgreSQL RLS, SELECT policies
--   are also applied to the NEW row version produced by UPDATE. tasks_select_policy
--   required deleted_at IS NULL, so setting deleted_at on soft delete makes the
--   NEW row fail SELECT even when tasks_update_policy WITH CHECK passes.
--   PostgreSQL surfaces this as SQLSTATE 42501:
--   "new row violates row-level security policy for table tasks".
--
-- Fix:
--   Scope tasks_select_policy to tenant (company_id) only. Operational exclusion
--   of soft-deleted rows remains in application queries (.is("deleted_at", null)).
--   tasks_update_policy keeps USING (deleted_at IS NULL) so only active rows are
--   mutable; demo read-only and multi-tenant guards unchanged.

DROP POLICY IF EXISTS tasks_select_policy ON public.tasks;

CREATE POLICY tasks_select_policy
  ON public.tasks
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

COMMENT ON POLICY tasks_select_policy ON public.tasks IS
  'Tenant-scoped read. deleted_at is not enforced in SELECT RLS so soft-delete UPDATE (PostgREST PATCH with WHERE) can commit; app queries filter active rows.';

-- Re-assert UPDATE policy (idempotent; unchanged from 20260916000100).
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
  'Multi-tenant updates on active rows only (USING). WITH CHECK permits soft delete within tenant; pairs with tenant-scoped SELECT policy.';
