-- Re-enable RLS on public.projects and public.crew_members after aligning
-- policies with the tasks / crews / employees soft-delete model.
--
-- Production currently has RLS OFF on both tables while policies still exist
-- (Supabase Security Advisor: policy_exists_rls_disabled / rls_disabled_in_public).
-- ENABLE is applied only after policy corrections so soft-delete PATCH cannot
-- fail with SQLSTATE 42501 (SELECT applied to the NEW row of UPDATE).
--
-- Does not FORCE ROW LEVEL SECURITY. Does not create DELETE policies for
-- authenticated on either table. Does not touch other tables.

-- ---------------------------------------------------------------------------
-- 1. projects SELECT — tenant only (no deleted_at gate)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_select_policy ON public.projects;

CREATE POLICY projects_select_policy
  ON public.projects
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

COMMENT ON POLICY projects_select_policy ON public.projects IS
  'Tenant-scoped read (company_id only). Soft-deleted rows are filtered by app queries via deleted_at IS NULL — same model as tasks/crews/employees.';

-- ---------------------------------------------------------------------------
-- 2. projects INSERT — keep tenant + demo write guard (re-asserted)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_insert_policy ON public.projects;

CREATE POLICY projects_insert_policy
  ON public.projects
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

COMMENT ON POLICY projects_insert_policy ON public.projects IS
  'Inserts only into the authenticated user company. Demo platform users cannot write.';

-- ---------------------------------------------------------------------------
-- 3. projects UPDATE — USING active tenant rows; WITH CHECK allows soft delete
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_update_policy ON public.projects;

CREATE POLICY projects_update_policy
  ON public.projects
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

COMMENT ON POLICY projects_update_policy ON public.projects IS
  'Multi-tenant updates on active rows only (USING). WITH CHECK permits soft delete within tenant; pairs with tenant-scoped SELECT policy.';

-- ---------------------------------------------------------------------------
-- 4. crew_members — drop orphan DELETE (no tenant check; not in git)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS crew_members_delete_policy ON public.crew_members;

-- ---------------------------------------------------------------------------
-- 5. crew_members SELECT / INSERT / UPDATE — re-assert current correct pattern
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS crew_members_select_policy ON public.crew_members;

CREATE POLICY crew_members_select_policy
  ON public.crew_members
  FOR SELECT
  USING (public.crew_member_belongs_to_user_company(crew_id));

COMMENT ON POLICY crew_members_select_policy ON public.crew_members IS
  'Tenant-scoped read via parent crew. Soft-deleted members filtered by app queries — same soft-delete SELECT model as crews.';

DROP POLICY IF EXISTS crew_members_insert_policy ON public.crew_members;

CREATE POLICY crew_members_insert_policy
  ON public.crew_members
  FOR INSERT
  WITH CHECK (
    public.crew_member_belongs_to_user_company(crew_id)
    AND NOT public.auth_is_demo_platform_read_only()
  );

COMMENT ON POLICY crew_members_insert_policy ON public.crew_members IS
  'Inserts only into a crew that belongs to the authenticated user company. Demo platform users cannot write.';

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

-- ---------------------------------------------------------------------------
-- 6. Enable RLS after policies are correct
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
