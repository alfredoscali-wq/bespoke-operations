-- Audit tasks table directly (Supabase SQL Editor — runs as postgres)
-- Project expected: uzupiqviwraxnnsymbdl

-- === 1. RLS flags on public.tasks ===
SELECT
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'tasks';

-- === 2. Triggers on public.tasks ===
SELECT *
FROM pg_trigger
WHERE tgrelid = 'public.tasks'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- === 3. Policies on public.tasks ===
SELECT *
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tasks'
ORDER BY policyname, cmd;

-- === 4. Table grants for anon / authenticated / postgres ===
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND grantee IN ('anon', 'authenticated', 'postgres', 'service_role')
ORDER BY grantee, privilege_type;

-- === 5–7. Temp task: insert + soft delete as postgres + verify ===
DO $$
DECLARE
  v_task_id uuid;
  v_code text;
BEGIN
  INSERT INTO public.tasks (
    code, title, description, project_code, project_name,
    type, status, priority, supervisor, crew,
    start_date, due_date, company_id
  )
  SELECT
    'TSK-AUDIT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'AUDIT TEMP TASK',
    'Temporary row for delete RLS audit',
    p.code, p.name,
    'maintenance', 'pendiente', 'baja',
    'Audit', 'Audit',
    CURRENT_DATE, CURRENT_DATE,
    p.company_id
  FROM public.projects p
  WHERE p.deleted_at IS NULL
  LIMIT 1
  RETURNING id, code INTO v_task_id, v_code;

  RAISE NOTICE '5. inserted temp task id=% code=%', v_task_id, v_code;

  UPDATE public.tasks
  SET deleted_at = now()
  WHERE id = v_task_id
    AND deleted_at IS NULL;

  RAISE NOTICE '6. postgres UPDATE deleted_at OK for id=%', v_task_id;

  PERFORM 1
  FROM public.tasks
  WHERE id = v_task_id
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '7. verify failed: deleted_at still null for id=%', v_task_id;
  END IF;

  RAISE NOTICE '7. verify OK: task id=% is soft-deleted', v_task_id;

  DELETE FROM public.tasks WHERE id = v_task_id;
  RAISE NOTICE '10. cleanup OK: temp task removed';
END $$;

-- === 8. Simulate anon role UPDATE deleted_at on an active task ===
DO $$
DECLARE
  v_task_id uuid;
  v_error text;
BEGIN
  SELECT id INTO v_task_id
  FROM public.tasks
  WHERE deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'No active task for anon simulation';
  END IF;

  SAVEPOINT role_test;
  BEGIN
    SET LOCAL ROLE anon;
    UPDATE public.tasks
    SET deleted_at = now()
    WHERE id = v_task_id
      AND deleted_at IS NULL;
    RAISE NOTICE '8. anon UPDATE deleted_at SUCCEEDED for id=%', v_task_id;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RAISE NOTICE '8. anon UPDATE deleted_at FAILED for id=%: %', v_task_id, v_error;
  END;
  ROLLBACK TO SAVEPOINT role_test;
  RESET ROLE;
END $$;

-- === 9. Simulate authenticated role UPDATE deleted_at ===
DO $$
DECLARE
  v_task_id uuid;
  v_error text;
BEGIN
  SELECT id INTO v_task_id
  FROM public.tasks
  WHERE deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'No active task for authenticated simulation';
  END IF;

  SAVEPOINT role_test;
  BEGIN
    SET LOCAL ROLE authenticated;
    UPDATE public.tasks
    SET deleted_at = now()
    WHERE id = v_task_id
      AND deleted_at IS NULL;
    RAISE NOTICE '9. authenticated UPDATE deleted_at SUCCEEDED for id=%', v_task_id;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RAISE NOTICE '9. authenticated UPDATE deleted_at FAILED for id=%: %', v_task_id, v_error;
  END;
  ROLLBACK TO SAVEPOINT role_test;
  RESET ROLE;
END $$;
