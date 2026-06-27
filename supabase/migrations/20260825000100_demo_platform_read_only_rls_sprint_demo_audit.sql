-- Demo Platform audit — bloqueo de escrituras para usuarios demo vía RLS.
-- Reutiliza company_id demo y system_role en JWT (user_metadata).

CREATE OR REPLACE FUNCTION public.auth_is_demo_platform_read_only()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'system_role') = 'demo',
    false
  )
  OR EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.app_user_id = auth.uid()
      AND e.deleted_at IS NULL
      AND e.company_id = '00000000-0000-4000-8000-000000000001'::uuid
  );
$$;

COMMENT ON FUNCTION public.auth_is_demo_platform_read_only() IS
  'True when the authenticated user is in demo read-only mode (rol demo o empresa Bespoke Demo).';

-- tasks
DROP POLICY IF EXISTS tasks_insert_policy ON public.tasks;
CREATE POLICY tasks_insert_policy
  ON public.tasks
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS tasks_update_policy ON public.tasks;
CREATE POLICY tasks_update_policy
  ON public.tasks
  FOR UPDATE
  USING (deleted_at IS NULL AND NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- projects
DROP POLICY IF EXISTS projects_insert_policy ON public.projects;
CREATE POLICY projects_insert_policy
  ON public.projects
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS projects_update_policy ON public.projects;
CREATE POLICY projects_update_policy
  ON public.projects
  FOR UPDATE
  USING (deleted_at IS NULL AND NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- project_history
DROP POLICY IF EXISTS project_history_insert_policy ON public.project_history;
CREATE POLICY project_history_insert_policy
  ON public.project_history
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- evidences
DROP POLICY IF EXISTS evidences_insert_policy ON public.evidences;
CREATE POLICY evidences_insert_policy
  ON public.evidences
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS evidences_update_policy ON public.evidences;
CREATE POLICY evidences_update_policy
  ON public.evidences
  FOR UPDATE
  USING (NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- crews
DROP POLICY IF EXISTS crews_insert_policy ON public.crews;
CREATE POLICY crews_insert_policy
  ON public.crews
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS crews_update_policy ON public.crews;
CREATE POLICY crews_update_policy
  ON public.crews
  FOR UPDATE
  USING (NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- crew_members
DROP POLICY IF EXISTS crew_members_insert_policy ON public.crew_members;
CREATE POLICY crew_members_insert_policy
  ON public.crew_members
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS crew_members_update_policy ON public.crew_members;
CREATE POLICY crew_members_update_policy
  ON public.crew_members
  FOR UPDATE
  USING (NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- employees
DROP POLICY IF EXISTS employees_insert_policy ON public.employees;
CREATE POLICY employees_insert_policy
  ON public.employees
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS employees_update_policy ON public.employees;
CREATE POLICY employees_update_policy
  ON public.employees
  FOR UPDATE
  USING (NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- customers
DROP POLICY IF EXISTS customers_insert_policy ON public.customers;
CREATE POLICY customers_insert_policy
  ON public.customers
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS customers_update_policy ON public.customers;
CREATE POLICY customers_update_policy
  ON public.customers
  FOR UPDATE
  USING (NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS customers_delete_policy ON public.customers;
CREATE POLICY customers_delete_policy
  ON public.customers
  FOR DELETE
  USING (deleted_at IS NULL AND NOT public.auth_is_demo_platform_read_only());

-- employee_availability
DROP POLICY IF EXISTS employee_availability_insert_policy ON public.employee_availability;
CREATE POLICY employee_availability_insert_policy
  ON public.employee_availability
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS employee_availability_update_policy ON public.employee_availability;
CREATE POLICY employee_availability_update_policy
  ON public.employee_availability
  FOR UPDATE
  USING (NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS employee_availability_delete_policy ON public.employee_availability;
CREATE POLICY employee_availability_delete_policy
  ON public.employee_availability
  FOR DELETE
  USING (NOT public.auth_is_demo_platform_read_only());

-- task_photos
DROP POLICY IF EXISTS task_photos_insert_policy ON public.task_photos;
CREATE POLICY task_photos_insert_policy
  ON public.task_photos
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS task_photos_update_policy ON public.task_photos;
CREATE POLICY task_photos_update_policy
  ON public.task_photos
  FOR UPDATE
  USING (NOT public.auth_is_demo_platform_read_only())
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

-- storage: evidences bucket
DROP POLICY IF EXISTS evidences_storage_insert ON storage.objects;
CREATE POLICY evidences_storage_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'evidences'
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS evidences_storage_update ON storage.objects;
CREATE POLICY evidences_storage_update
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'evidences'
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS evidences_storage_delete ON storage.objects;
CREATE POLICY evidences_storage_delete
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'evidences'
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- storage: task-photos bucket
DROP POLICY IF EXISTS task_photos_storage_insert ON storage.objects;
CREATE POLICY task_photos_storage_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'task-photos'
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS task_photos_storage_update ON storage.objects;
CREATE POLICY task_photos_storage_update
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'task-photos'
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS task_photos_storage_delete ON storage.objects;
CREATE POLICY task_photos_storage_delete
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'task-photos'
    AND NOT public.auth_is_demo_platform_read_only()
  );
