-- Sprint C1 — Multi-tenant RLS isolation for core operational tables.
-- Replaces development-era policies (deleted_at only / USING true) with company_id scoping
-- via public.auth_user_company_id(), preserving demo read-only write guards.

-- tasks
DROP POLICY IF EXISTS tasks_select_policy ON public.tasks;
CREATE POLICY tasks_select_policy
  ON public.tasks
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS tasks_insert_policy ON public.tasks;
CREATE POLICY tasks_insert_policy
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

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
  );

-- projects
DROP POLICY IF EXISTS projects_select_policy ON public.projects;
CREATE POLICY projects_select_policy
  ON public.projects
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS projects_insert_policy ON public.projects;
CREATE POLICY projects_insert_policy
  ON public.projects
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

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
  );

-- customers
DROP POLICY IF EXISTS customers_select_policy ON public.customers;
CREATE POLICY customers_select_policy
  ON public.customers
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS customers_insert_policy ON public.customers;
CREATE POLICY customers_insert_policy
  ON public.customers
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS customers_update_policy ON public.customers;
CREATE POLICY customers_update_policy
  ON public.customers
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS customers_delete_policy ON public.customers;
CREATE POLICY customers_delete_policy
  ON public.customers
  FOR DELETE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- crews
DROP POLICY IF EXISTS crews_select_policy ON public.crews;
CREATE POLICY crews_select_policy
  ON public.crews
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS crews_insert_policy ON public.crews;
CREATE POLICY crews_insert_policy
  ON public.crews
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

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
  );

-- employees
DROP POLICY IF EXISTS employees_select_policy ON public.employees;
CREATE POLICY employees_select_policy
  ON public.employees
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS employees_insert_policy ON public.employees;
CREATE POLICY employees_insert_policy
  ON public.employees
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS employees_update_policy ON public.employees;
CREATE POLICY employees_update_policy
  ON public.employees
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- evidences (includes voided rows for audit within tenant)
DROP POLICY IF EXISTS evidences_select_policy ON public.evidences;
CREATE POLICY evidences_select_policy
  ON public.evidences
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS evidences_insert_policy ON public.evidences;
CREATE POLICY evidences_insert_policy
  ON public.evidences
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS evidences_update_policy ON public.evidences;
CREATE POLICY evidences_update_policy
  ON public.evidences
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- mobile_devices
DROP POLICY IF EXISTS mobile_devices_select_policy ON public.mobile_devices;
CREATE POLICY mobile_devices_select_policy
  ON public.mobile_devices
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS mobile_devices_insert_policy ON public.mobile_devices;
CREATE POLICY mobile_devices_insert_policy
  ON public.mobile_devices
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS mobile_devices_update_policy ON public.mobile_devices;
CREATE POLICY mobile_devices_update_policy
  ON public.mobile_devices
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- work_team_shifts
DROP POLICY IF EXISTS work_team_shifts_select_policy ON public.work_team_shifts;
CREATE POLICY work_team_shifts_select_policy
  ON public.work_team_shifts
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS work_team_shifts_insert_policy ON public.work_team_shifts;
CREATE POLICY work_team_shifts_insert_policy
  ON public.work_team_shifts
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS work_team_shifts_update_policy ON public.work_team_shifts;
CREATE POLICY work_team_shifts_update_policy
  ON public.work_team_shifts
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- task_execution_starts (fix invalid auth_company_id reference on re-apply)
DROP POLICY IF EXISTS task_execution_starts_select_policy ON public.task_execution_starts;
CREATE POLICY task_execution_starts_select_policy
  ON public.task_execution_starts
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

-- work_order_type_incident_types (same auth function fix)
DROP POLICY IF EXISTS work_order_type_incident_types_select_policy ON public.work_order_type_incident_types;
CREATE POLICY work_order_type_incident_types_select_policy
  ON public.work_order_type_incident_types
  FOR SELECT
  USING (company_id = public.auth_user_company_id());
