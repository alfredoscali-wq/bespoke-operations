-- Cleanup E2E / manual validation residuals (run in Supabase SQL Editor)
-- Uses postgres role — bypasses RLS for hard deletes.

BEGIN;

DELETE FROM public.evidences
WHERE task_id IN (SELECT id FROM public.tasks WHERE code LIKE 'E2E-%')
   OR project_id IN (SELECT id FROM public.projects WHERE code LIKE 'E2E-%');

DELETE FROM public.tasks WHERE code LIKE 'E2E-%';

DELETE FROM public.crew_members
WHERE name = 'Operario Prueba'
   OR crew_id IN (SELECT id FROM public.crews WHERE name LIKE 'Cuadrilla E2E-%');

DELETE FROM public.crews WHERE name LIKE 'Cuadrilla E2E-%';

DELETE FROM public.projects
WHERE code LIKE 'E2E-%'
   OR client = 'Cliente Demo';

DELETE FROM public.employees
WHERE employee_code LIKE 'E2E-%'
   OR (first_name = 'Supervisor' AND last_name = 'Prueba')
   OR (first_name = 'Operario' AND last_name = 'Prueba');

COMMIT;

SELECT 'employees' AS entity, COUNT(*) AS active FROM public.employees WHERE deleted_at IS NULL
UNION ALL SELECT 'crews', COUNT(*) FROM public.crews WHERE deleted_at IS NULL
UNION ALL SELECT 'projects', COUNT(*) FROM public.projects WHERE deleted_at IS NULL
UNION ALL SELECT 'tasks', COUNT(*) FROM public.tasks WHERE deleted_at IS NULL
UNION ALL SELECT 'evidences', COUNT(*) FROM public.evidences WHERE deleted_at IS NULL;
