-- OT 1.1 — Atomic execution_order on task create.
-- Does not modify tasks_execution_order_crew_date_unique.
-- Does not change vencida policy (OT 1.2).

CREATE OR REPLACE FUNCTION public.create_task_with_execution_order(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_crew_id uuid;
  v_due_date date;
  v_project_id uuid;
  v_status text;
  v_should_assign boolean;
  v_execution_order integer;
  v_row public.tasks;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'La plataforma de demostracion es de solo lectura.';
  END IF;

  -- Tenant comes from the session, never from the client payload.
  v_payload := v_payload || jsonb_build_object('company_id', v_company_id);

  v_crew_id := NULLIF(btrim(COALESCE(v_payload->>'crew_id', '')), '')::uuid;
  v_due_date := NULLIF(btrim(COALESCE(v_payload->>'due_date', '')), '')::date;
  v_project_id := NULLIF(btrim(COALESCE(v_payload->>'project_id', '')), '')::uuid;
  v_status := NULLIF(btrim(COALESCE(v_payload->>'status', '')), '');

  -- Same create-time gate as the previous frontend assignment:
  -- service OT (not Obra) + crew + due_date + programada.
  -- Occupancy matches tasks_execution_order_crew_date_unique
  -- (execution_order IS NOT NULL AND crew_id IS NOT NULL AND deleted_at IS NULL).
  v_should_assign :=
    v_crew_id IS NOT NULL
    AND v_due_date IS NOT NULL
    AND v_project_id IS NULL
    AND (
      COALESCE(v_payload->>'project_code', '') = 'OT'
      OR NULLIF(btrim(COALESCE(v_payload->>'service_type', '')), '') IS NOT NULL
    )
    AND COALESCE(v_status, 'programada') = 'programada';

  v_execution_order := NULL;

  IF v_should_assign THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('ot-exec-order:' || v_company_id::text),
      hashtext(v_crew_id::text || ':' || v_due_date::text)
    );

    SELECT COALESCE(
      (
        SELECT MIN(s.n)
        FROM generate_series(
          1,
          COALESCE(
            (
              SELECT MAX(t.execution_order)
              FROM public.tasks t
              WHERE t.company_id = v_company_id
                AND t.crew_id = v_crew_id
                AND t.due_date = v_due_date
                AND t.deleted_at IS NULL
                AND t.execution_order IS NOT NULL
            ),
            0
          ) + 1
        ) AS s(n)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.tasks t
          WHERE t.company_id = v_company_id
            AND t.crew_id = v_crew_id
            AND t.due_date = v_due_date
            AND t.deleted_at IS NULL
            AND t.execution_order = s.n
        )
      ),
      1
    )
    INTO v_execution_order;
  END IF;

  BEGIN
    INSERT INTO public.tasks (
      company_id,
      code,
      title,
      description,
      project_id,
      project_code,
      project_name,
      customer_company,
      customer_name,
      customer_phone,
      customer_dni,
      customer_id,
      service_address,
      latitude,
      longitude,
      location_resolution_method,
      shared_location,
      observations_for_crew,
      work_order_number,
      type,
      status,
      priority,
      supervisor,
      crew_id,
      crew,
      start_date,
      due_date,
      scheduled_time,
      estimated_duration,
      checklist,
      operational_steps,
      progress,
      service_type,
      locality,
      contracted_plan,
      service_catalog_id,
      installation_cost,
      amount_to_collect,
      payment_method,
      task_metadata,
      execution_order,
      dispatch_order
    )
    VALUES (
      v_company_id,
      btrim(v_payload->>'code'),
      btrim(v_payload->>'title'),
      COALESCE(v_payload->>'description', ''),
      v_project_id,
      COALESCE(v_payload->>'project_code', ''),
      COALESCE(v_payload->>'project_name', ''),
      NULLIF(btrim(COALESCE(v_payload->>'customer_company', '')), ''),
      NULLIF(btrim(COALESCE(v_payload->>'customer_name', '')), ''),
      NULLIF(btrim(COALESCE(v_payload->>'customer_phone', '')), ''),
      NULLIF(btrim(COALESCE(v_payload->>'customer_dni', '')), ''),
      NULLIF(btrim(COALESCE(v_payload->>'customer_id', '')), '')::uuid,
      NULLIF(btrim(COALESCE(v_payload->>'service_address', '')), ''),
      CASE
        WHEN jsonb_typeof(v_payload->'latitude') = 'number'
          THEN (v_payload->>'latitude')::double precision
        ELSE NULL
      END,
      CASE
        WHEN jsonb_typeof(v_payload->'longitude') = 'number'
          THEN (v_payload->>'longitude')::double precision
        ELSE NULL
      END,
      NULLIF(btrim(COALESCE(v_payload->>'location_resolution_method', '')), ''),
      COALESCE(v_payload->>'shared_location', ''),
      COALESCE(v_payload->>'observations_for_crew', ''),
      NULLIF(btrim(COALESCE(v_payload->>'work_order_number', '')), ''),
      (v_payload->>'type')::public.task_type,
      COALESCE(
        NULLIF(btrim(COALESCE(v_payload->>'status', '')), ''),
        'programada'
      )::public.task_status,
      COALESCE(
        NULLIF(btrim(COALESCE(v_payload->>'priority', '')), ''),
        'media'
      )::public.task_priority,
      COALESCE(v_payload->>'supervisor', ''),
      v_crew_id,
      COALESCE(v_payload->>'crew', ''),
      (v_payload->>'start_date')::date,
      (v_payload->>'due_date')::date,
      NULLIF(btrim(COALESCE(v_payload->>'scheduled_time', '')), ''),
      COALESCE(v_payload->>'estimated_duration', ''),
      COALESCE(v_payload->'checklist', '[]'::jsonb),
      COALESCE(v_payload->'operational_steps', '[]'::jsonb),
      COALESCE((v_payload->>'progress')::integer, 0),
      NULLIF(btrim(COALESCE(v_payload->>'service_type', '')), ''),
      NULLIF(btrim(COALESCE(v_payload->>'locality', '')), ''),
      NULLIF(btrim(COALESCE(v_payload->>'contracted_plan', '')), ''),
      NULLIF(btrim(COALESCE(v_payload->>'service_catalog_id', '')), '')::uuid,
      CASE
        WHEN jsonb_typeof(v_payload->'installation_cost') = 'number'
          THEN (v_payload->>'installation_cost')::numeric
        ELSE NULL
      END,
      CASE
        WHEN jsonb_typeof(v_payload->'amount_to_collect') = 'number'
          THEN (v_payload->>'amount_to_collect')::numeric
        ELSE NULL
      END,
      NULLIF(btrim(COALESCE(v_payload->>'payment_method', '')), ''),
      COALESCE(v_payload->'task_metadata', '{}'::jsonb),
      v_execution_order,
      NULL
    )
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN unique_violation THEN
      IF SQLERRM ILIKE '%tasks_execution_order_crew_date_unique%' THEN
        RAISE LOG
          'TASK_EXECUTION_ORDER_CONFLICT company_id=% crew_id=% due_date=%',
          v_company_id,
          v_crew_id,
          v_due_date;
        RAISE EXCEPTION 'TASK_EXECUTION_ORDER_CONFLICT'
          USING ERRCODE = 'P0001',
                MESSAGE = 'No pudimos asignar el orden de ejecución. Intentá nuevamente.',
                HINT = 'TASK_EXECUTION_ORDER_CONFLICT';
      END IF;
      RAISE;
  END;

  RAISE LOG
    'create_task_with_execution_order company_id=% crew_id=% due_date=% execution_order=%',
    v_company_id,
    v_crew_id,
    v_due_date,
    v_row.execution_order;

  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.create_task_with_execution_order(jsonb) IS
  'Creates a task and assigns execution_order atomically for company+crew+due_date. Client execution_order is ignored. Unique index tasks_execution_order_crew_date_unique remains the last barrier.';

REVOKE ALL ON FUNCTION public.create_task_with_execution_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_task_with_execution_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_task_with_execution_order(jsonb) TO service_role;
