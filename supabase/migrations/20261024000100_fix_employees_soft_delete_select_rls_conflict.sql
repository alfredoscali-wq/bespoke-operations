-- Align employees soft-delete RLS with the proven tasks model (20260917000100).
--
-- Objective:
--   Soft delete on employees must succeed under PostgREST/RLS the same way tasks do.
--   Multi-tenant isolation remains solely via company_id = auth_user_company_id().
--   Active-employee filtering stays in application queries (.is("deleted_at", null)),
--   not in SELECT RLS.
--
-- Root cause (same class as tasks):
--   An UPDATE evaluated through PostgREST includes a WHERE clause
--   (e.g. id=eq.<uuid>&deleted_at=is.null). Per PostgreSQL RLS, SELECT policies
--   are also applied to the NEW row version produced by UPDATE. employees_select_policy
--   required deleted_at IS NULL, so setting deleted_at on soft delete makes the
--   NEW row fail SELECT even when employees_update_policy WITH CHECK passes.
--   PostgreSQL surfaces this as SQLSTATE 42501:
--   "new row violates row-level security policy for table employees".
--
-- Audit (remote, 2026-07-20):
--   - Policies on employees: select / insert / update only (no extras, no DELETE).
--   - Triggers: set_employees_updated_at (touches updated_at only);
--     enforce_employees_employee_type_tenant_integrity (fires only on
--     UPDATE OF employee_type_id, company_id — not on soft delete).
--   - No rewrite rules on employees.
--   - auth helpers unchanged; do not alter deleted_at / company_id on UPDATE.
--   - Live tasks_select_policy is already tenant-only (no deleted_at); employees was not.
--
-- Fix:
--   Scope employees_select_policy to tenant (company_id) only.
--   Align UPDATE with the tasks pattern: USING only on active rows;
--   WITH CHECK permits soft delete within tenant + demo guard.

DROP POLICY IF EXISTS employees_select_policy ON public.employees;

CREATE POLICY employees_select_policy
  ON public.employees
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

COMMENT ON POLICY employees_select_policy ON public.employees IS
  'Tenant-scoped read (company_id only). Soft-deleted rows are filtered by app queries via deleted_at IS NULL — same model as tasks.';

DROP POLICY IF EXISTS employees_update_policy ON public.employees;

CREATE POLICY employees_update_policy
  ON public.employees
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

COMMENT ON POLICY employees_update_policy ON public.employees IS
  'Multi-tenant updates on active rows only (USING). WITH CHECK permits soft delete within tenant; pairs with tenant-scoped SELECT policy (aligned with tasks).';
