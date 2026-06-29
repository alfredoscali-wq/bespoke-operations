-- =============================================================================
-- Bespoke Operations — Seed operational test data (post-reset)
-- =============================================================================
-- Run AFTER: reset_operational_test_data.sql (or on empty operational tables)
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_company_id uuid := '00000000-0000-4000-8000-000000000001';
  v_supervisor_id uuid;
  v_operario_id uuid;
  v_crew_id uuid;
  v_project_id uuid;
  v_task_id uuid;
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
BEGIN
  INSERT INTO public.employees (
    company_id, employee_code, first_name, last_name, job_title, department,
    employee_type, employment_status, notes
  ) VALUES (
    v_company_id,
    'SUP-' || v_suffix,
    'Carlos',
    'Supervisor',
    'Supervisor de obra',
    'Operaciones',
    'supervisor',
    'active',
    'Seed funcional'
  )
  RETURNING id INTO v_supervisor_id;

  INSERT INTO public.employees (
    company_id, employee_code, first_name, last_name, job_title, department,
    employee_type, employment_status, notes
  ) VALUES (
    v_company_id,
    'OP-' || v_suffix,
    'María',
    'Operaria',
    'Operaria',
    'Operaciones',
    'operario',
    'active',
    'Seed funcional'
  )
  RETURNING id INTO v_operario_id;

  INSERT INTO public.crews (
    company_id, name, description, supervisor, supervisor_employee_id, status, notes
  ) VALUES (
    v_company_id,
    'Cuadrilla Alpha ' || v_suffix,
    'Cuadrilla de prueba funcional',
    'Carlos Supervisor',
    v_supervisor_id,
    'activa',
    ''
  )
  RETURNING id INTO v_crew_id;

  INSERT INTO public.crew_members (
    crew_id, employee_id, name, role, active
  ) VALUES (
    v_crew_id,
    v_operario_id,
    'María Operaria',
    'Operaria',
    true
  );

  INSERT INTO public.projects (
    company_id, code, name, client, type, status, progress,
    supervisor, location, description, start_date, end_date
  ) VALUES (
    v_company_id,
    'OB-' || v_suffix,
    'Obra Residencial ' || v_suffix,
    'Cliente Demo SA',
    'fiber',
    'active',
    15,
    'Carlos Supervisor',
    'Asunción',
    'Obra seed para validación CRUD desde grillas',
    '2026-06-01',
    '2026-12-31'
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.tasks (
    company_id, code, title, description, project_id, project_code, project_name,
    type, status, priority, supervisor, crew_id, crew,
    start_date, due_date, estimated_duration, checklist, progress
  ) VALUES (
    v_company_id,
    'TK-' || v_suffix,
    'Instalación eléctrica ' || v_suffix,
    'Tarea seed para validación CRUD',
    v_project_id,
    'OB-' || v_suffix,
    'Obra Residencial ' || v_suffix,
    'fiber',
    'programada',
    'media',
    'Carlos Supervisor',
    v_crew_id,
    'Cuadrilla Alpha ' || v_suffix,
    '2026-06-10',
    '2026-06-30',
    '3 días',
    '[]'::jsonb,
    0
  )
  RETURNING id INTO v_task_id;

  RAISE NOTICE 'Seed OK — suffix %', v_suffix;
  RAISE NOTICE 'supervisor_id=% operario_id=% crew_id=% project_id=% task_id=%',
    v_supervisor_id, v_operario_id, v_crew_id, v_project_id, v_task_id;
END $$;

COMMIT;

SELECT 'employees' AS entity, COUNT(*) AS active FROM public.employees WHERE deleted_at IS NULL
UNION ALL
SELECT 'crews', COUNT(*) FROM public.crews WHERE deleted_at IS NULL
UNION ALL
SELECT 'crew_members', COUNT(*) FROM public.crew_members WHERE deleted_at IS NULL
UNION ALL
SELECT 'projects', COUNT(*) FROM public.projects WHERE deleted_at IS NULL
UNION ALL
SELECT 'tasks', COUNT(*) FROM public.tasks WHERE deleted_at IS NULL;
