-- Align crews / crew_members soft-delete RLS with tasks (20260917000100)
-- and employees (20261024000100).
--
-- Root cause:
--   PostgREST PATCH soft-delete sets deleted_at on crews. PostgreSQL RLS also
--   applies SELECT policies to the NEW row of an UPDATE. crews_select_policy
--   required deleted_at IS NULL, so the NEW row fails SELECT even when
--   crews_update_policy WITH CHECK passes. Surfaced as SQLSTATE 42501:
--   "new row violates row-level security policy for table crews".
--
-- Auth / WITH CHECK are not the failure mode when company_id is unchanged:
--   auth_user_company_id() resolves via employees.app_user_id = auth.uid().
--   UPDATE WITH CHECK already allows deleted_at to become non-null.
--
-- Fix:
--   Scope SELECT to tenant only (company_id / parent crew). App queries keep
--   filtering active rows with .is("deleted_at", null).
--   Re-assert UPDATE: USING only active rows; WITH CHECK permits soft delete.

DROP POLICY IF EXISTS crews_select_policy ON public.crews;

CREATE POLICY crews_select_policy
  ON public.crews
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

COMMENT ON POLICY crews_select_policy ON public.crews IS
  'Tenant-scoped read (company_id only). Soft-deleted rows are filtered by app queries via deleted_at IS NULL — same model as tasks/employees.';

DROP POLICY IF EXISTS crews_update_policy ON public.crews;

CREATE POLICY crews_update_policy
  ON public.crews
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

COMMENT ON POLICY crews_update_policy ON public.crews IS
  'Multi-tenant updates on active rows only (USING). WITH CHECK permits soft delete within tenant; pairs with tenant-scoped SELECT policy.';

DROP POLICY IF EXISTS crew_members_select_policy ON public.crew_members;

CREATE POLICY crew_members_select_policy
  ON public.crew_members
  FOR SELECT
  USING (public.crew_member_belongs_to_user_company(crew_id));

COMMENT ON POLICY crew_members_select_policy ON public.crew_members IS
  'Tenant-scoped read via parent crew. Soft-deleted members filtered by app queries — same soft-delete SELECT model as crews.';

DROP POLICY IF EXISTS crew_members_update_policy ON public.crew_members;

CREATE POLICY crew_members_update_policy
  ON public.crew_members
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.crew_member_belongs_to_user_company(crew_id)
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    public.crew_member_belongs_to_user_company(crew_id)
    AND NOT public.auth_is_demo_platform_read_only()
    AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
  );

COMMENT ON POLICY crew_members_update_policy ON public.crew_members IS
  'Updates on active members only (USING). WITH CHECK permits soft delete within tenant; pairs with SELECT without deleted_at gate.';
