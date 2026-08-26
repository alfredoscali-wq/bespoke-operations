-- OT 1.5.1 — Idempotent work-order creation.
-- Does not modify tasks_execution_order_crew_date_unique.
-- Does not change vencida policy (OT 1.2).
-- Does not duplicate execution_order assignment: create_work_order_idempotent
-- calls create_task_with_execution_order.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

COMMENT ON COLUMN public.tasks.idempotency_key IS
  'OT 1.5.1 — UUID of a single create operation. NULL for Obra, import (until 1.5.2), and historical rows. Frozen after first set. Unique per company including soft-deleted rows.';

CREATE UNIQUE INDEX IF NOT EXISTS tasks_company_idempotency_key_unique
  ON public.tasks (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON INDEX public.tasks_company_idempotency_key_unique IS
  'One create operation per company+key. Includes soft-deleted rows so a key cannot mint a second OT.';

-- Freeze the key after it is first assigned (wrapper sets NULL → uuid on create).
-- Edits must not rotate or clear it.
CREATE OR REPLACE FUNCTION public.freeze_task_idempotency_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.idempotency_key IS NOT NULL THEN
    NEW.idempotency_key := OLD.idempotency_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_freeze_idempotency_key ON public.tasks;
CREATE TRIGGER tasks_freeze_idempotency_key
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_task_idempotency_key();

CREATE OR REPLACE FUNCTION public.create_work_order_idempotent(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_key uuid;
  v_existing public.tasks;
  v_task_payload jsonb;
  v_task_json jsonb;
  v_row public.tasks;
  v_customer_id uuid;
  v_payload_customer_id uuid;
  v_create_customer jsonb;
  v_next_num integer;
  v_atencion_id uuid;
  v_solicitud_id uuid;
  v_employee_id uuid;
  v_linked_task_id uuid;
  v_created boolean := false;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'La plataforma de demostracion es de solo lectura.';
  END IF;

  BEGIN
    v_key := NULLIF(btrim(COALESCE(v_payload->>'idempotency_key', '')), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_INVALID'
        USING ERRCODE = 'P0001',
              MESSAGE = 'La clave de operación no es válida.',
              HINT = 'IDEMPOTENCY_KEY_INVALID';
  END;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_INVALID'
      USING ERRCODE = 'P0001',
            MESSAGE = 'La clave de operación no es válida.',
            HINT = 'IDEMPOTENCY_KEY_INVALID';
  END IF;

  v_payload_customer_id := NULLIF(btrim(COALESCE(v_payload->>'customer_id', '')), '')::uuid;
  v_create_customer := CASE
    WHEN jsonb_typeof(v_payload->'create_customer') = 'object'
      THEN v_payload->'create_customer'
    ELSE NULL
  END;
  v_atencion_id := NULLIF(btrim(COALESCE(v_payload->>'atencion_id', '')), '')::uuid;
  v_solicitud_id := NULLIF(
    btrim(COALESCE(v_payload->>'commercial_solicitud_id', '')),
    ''
  )::uuid;

  PERFORM pg_advisory_xact_lock(
    hashtext('ot-idem:' || v_company_id::text),
    hashtext(v_key::text)
  );

  SELECT *
  INTO v_existing
  FROM public.tasks t
  WHERE t.company_id = v_company_id
    AND t.idempotency_key = v_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_OPERATION_DELETED'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Esta operación ya creó una orden de trabajo que fue eliminada. Cancelá y abrí una nueva OT para generar otra.',
              HINT = 'IDEMPOTENCY_OPERATION_DELETED';
    END IF;

    IF v_payload_customer_id IS NOT NULL
       AND v_existing.customer_id IS NOT NULL
       AND v_payload_customer_id IS DISTINCT FROM v_existing.customer_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Esta operación ya creó una OT con otros datos. Cancelá y abrí una nueva OT.',
              HINT = 'IDEMPOTENCY_PAYLOAD_CONFLICT';
    END IF;

    IF v_atencion_id IS NOT NULL THEN
      SELECT ca.linked_task_id
      INTO v_linked_task_id
      FROM public.customer_atenciones ca
      WHERE ca.id = v_atencion_id
        AND ca.company_id = v_company_id
        AND ca.deleted_at IS NULL;

      IF v_linked_task_id IS NOT NULL
         AND v_linked_task_id IS DISTINCT FROM v_existing.id THEN
        RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT'
          USING ERRCODE = 'P0001',
                MESSAGE = 'Esta operación ya creó una OT con otros datos. Cancelá y abrí una nueva OT.',
                HINT = 'IDEMPOTENCY_PAYLOAD_CONFLICT';
      END IF;
    END IF;

    IF v_solicitud_id IS NOT NULL THEN
      SELECT cs.work_order_id
      INTO v_linked_task_id
      FROM public.commercial_solicitudes cs
      WHERE cs.id = v_solicitud_id
        AND cs.company_id = v_company_id
        AND cs.deleted_at IS NULL;

      IF v_linked_task_id IS NOT NULL
         AND v_linked_task_id IS DISTINCT FROM v_existing.id THEN
        RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT'
          USING ERRCODE = 'P0001',
                MESSAGE = 'Esta operación ya creó una OT con otros datos. Cancelá y abrí una nueva OT.',
                HINT = 'IDEMPOTENCY_PAYLOAD_CONFLICT';
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'task', to_jsonb(v_existing),
      'task_id', v_existing.id,
      'created', false,
      'idempotent_replay', true
    );
  END IF;

  v_customer_id := v_payload_customer_id;

  IF v_customer_id IS NULL AND v_create_customer IS NOT NULL THEN
    IF NULLIF(btrim(COALESCE(v_create_customer->>'name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'El nombre del cliente es obligatorio.';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtext('ot-cust-num:' || v_company_id::text)
    );

    SELECT COALESCE(
      MAX(
        CASE
          WHEN c.customer_number ~ '^CLI-[0-9]+$'
            THEN substring(c.customer_number from 5)::integer
          ELSE 0
        END
      ),
      0
    ) + 1
    INTO v_next_num
    FROM public.customers c
    WHERE c.company_id = v_company_id;

    INSERT INTO public.customers (
      company_id,
      customer_number,
      name,
      dni,
      phone,
      email,
      address,
      locality,
      technology,
      contracted_plan,
      latitude,
      longitude,
      shared_location,
      status,
      validation_status
    )
    VALUES (
      v_company_id,
      'CLI-' || lpad(v_next_num::text, 6, '0'),
      btrim(v_create_customer->>'name'),
      NULLIF(btrim(COALESCE(v_create_customer->>'dni', '')), ''),
      NULLIF(btrim(COALESCE(v_create_customer->>'phone', '')), ''),
      NULLIF(btrim(COALESCE(v_create_customer->>'email', '')), ''),
      NULLIF(btrim(COALESCE(v_create_customer->>'address', '')), ''),
      NULLIF(btrim(COALESCE(v_create_customer->>'locality', '')), ''),
      NULLIF(btrim(COALESCE(v_create_customer->>'technology', '')), ''),
      NULLIF(btrim(COALESCE(v_create_customer->>'contracted_plan', '')), ''),
      CASE
        WHEN jsonb_typeof(v_create_customer->'latitude') = 'number'
          THEN (v_create_customer->>'latitude')::double precision
        ELSE NULL
      END,
      CASE
        WHEN jsonb_typeof(v_create_customer->'longitude') = 'number'
          THEN (v_create_customer->>'longitude')::double precision
        ELSE NULL
      END,
      NULLIF(btrim(COALESCE(v_create_customer->>'shared_location', '')), ''),
      COALESCE(NULLIF(btrim(COALESCE(v_create_customer->>'status', '')), ''), 'activo'),
      COALESCE(NULLIF(btrim(COALESCE(v_create_customer->>'validation_status', '')), ''), 'active')
    )
    RETURNING id INTO v_customer_id;
  END IF;

  v_task_payload :=
    (v_payload - 'create_customer' - 'atencion_id' - 'commercial_solicitud_id')
    || jsonb_build_object('company_id', v_company_id);

  IF v_customer_id IS NOT NULL THEN
    v_task_payload := v_task_payload || jsonb_build_object(
      'customer_id',
      v_customer_id
    );
  END IF;

  v_task_json := public.create_task_with_execution_order(v_task_payload);

  UPDATE public.tasks t
  SET idempotency_key = v_key
  WHERE t.id = (v_task_json->>'id')::uuid
    AND t.company_id = v_company_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No fue posible persistir la clave de operación de la OT.';
  END IF;

  v_created := true;

  IF v_atencion_id IS NOT NULL OR v_solicitud_id IS NOT NULL THEN
    SELECT e.id
    INTO v_employee_id
    FROM public.employees e
    WHERE e.app_user_id = auth.uid()
      AND e.company_id = v_company_id
      AND e.deleted_at IS NULL
    ORDER BY e.created_at
    LIMIT 1;
  END IF;

  IF v_atencion_id IS NOT NULL THEN
    IF v_employee_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo resolver el empleado de la sesión para vincular la consulta.';
    END IF;

    PERFORM public.link_customer_atencion_to_task(
      v_company_id,
      v_atencion_id,
      v_employee_id,
      v_row.id
    );
  END IF;

  IF v_solicitud_id IS NOT NULL THEN
    SELECT cs.work_order_id
    INTO v_linked_task_id
    FROM public.commercial_solicitudes cs
    WHERE cs.id = v_solicitud_id
      AND cs.company_id = v_company_id
      AND cs.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Solicitud comercial no encontrada.';
    END IF;

    IF v_linked_task_id IS NOT NULL
       AND v_linked_task_id IS DISTINCT FROM v_row.id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Esta operación ya creó una OT con otros datos. Cancelá y abrí una nueva OT.',
              HINT = 'IDEMPOTENCY_PAYLOAD_CONFLICT';
    END IF;

    UPDATE public.commercial_solicitudes cs
    SET
      work_order_id = v_row.id,
      status = 'ot_generada',
      resolution_code = 'venta_concretada',
      updated_by = v_employee_id,
      updated_at = now()
    WHERE cs.id = v_solicitud_id
      AND cs.company_id = v_company_id
      AND cs.deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'task', to_jsonb(v_row),
    'task_id', v_row.id,
    'created', v_created,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.create_work_order_idempotent(jsonb) IS
  'OT 1.5.1 — idempotent work-order create. Tenant from auth_user_company_id(). Same key returns the existing OT. Optional in-transaction customer create + Atención/Comercial links. Calls create_task_with_execution_order for slot assignment.';

REVOKE ALL ON FUNCTION public.create_work_order_idempotent(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_work_order_idempotent(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_work_order_idempotent(jsonb) TO service_role;
