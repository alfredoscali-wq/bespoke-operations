-- =============================================================================
-- Bespoke Operations — Reset demo company data (Demo Platform 1.0)
-- =============================================================================
-- Removes seeded demo data only. Preserves the Bespoke Demo company row and
-- any manually provisioned demo users linked to non-seed employees.
--
-- Safe marker: external_customer_code / employee_code prefixed with DEMO-SEED / DEMO-
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_company_id uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  DELETE FROM public.automatic_report_history
  WHERE generated_by = 'Demo Seed';

  DELETE FROM public.system_audit_log
  WHERE metadata ->> 'demoSeed' = 'true';

  DELETE FROM public.evidences
  WHERE company_id = v_company_id
    AND file_name LIKE 'demo-seed-%';

  DELETE FROM public.task_photos
  WHERE task_id IN (
    SELECT id FROM public.tasks WHERE company_id = v_company_id AND code LIKE 'DEMO-%'
  );

  DELETE FROM public.tasks
  WHERE company_id = v_company_id
    AND code LIKE 'DEMO-%';

  DELETE FROM public.crew_members
  WHERE crew_id IN (
    SELECT id FROM public.crews WHERE company_id = v_company_id AND name LIKE 'Cuadrilla Demo %'
  );

  DELETE FROM public.crews
  WHERE company_id = v_company_id
    AND name LIKE 'Cuadrilla Demo %';

  DELETE FROM public.project_history
  WHERE project_id IN (
    SELECT id FROM public.projects WHERE company_id = v_company_id AND code LIKE 'DEMO-OB-%'
  );

  DELETE FROM public.projects
  WHERE company_id = v_company_id
    AND code LIKE 'DEMO-OB-%';

  DELETE FROM public.employee_availability
  WHERE company_id = v_company_id
    AND reason LIKE 'Demo Seed%';

  DELETE FROM public.employees
  WHERE company_id = v_company_id
    AND employee_code LIKE 'DEMO-EMP-%';

  DELETE FROM public.customers
  WHERE external_customer_code LIKE 'DEMO-SEED-%';
END $$;

COMMIT;

SELECT
  'customers (demo seed)' AS entity,
  COUNT(*)::bigint AS remaining
FROM public.customers
WHERE external_customer_code LIKE 'DEMO-SEED-%'
UNION ALL
SELECT 'employees (demo seed)', COUNT(*)
FROM public.employees
WHERE employee_code LIKE 'DEMO-EMP-%'
UNION ALL
SELECT 'tasks (demo seed)', COUNT(*)
FROM public.tasks
WHERE code LIKE 'DEMO-%';
