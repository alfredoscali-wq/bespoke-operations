-- Materiales 1.3 — Consumo al cierre de OT (solo si hay líneas de catálogo reservadas).

ALTER TYPE public.material_movement_type ADD VALUE IF NOT EXISTS 'consumption';
ALTER TYPE public.material_movement_type ADD VALUE IF NOT EXISTS 'return';

ALTER TYPE public.task_material_line_status ADD VALUE IF NOT EXISTS 'consumed';

ALTER TABLE public.task_material_lines
  ADD COLUMN IF NOT EXISTS quantity_consumed numeric(18, 4),
  ADD COLUMN IF NOT EXISTS quantity_returned numeric(18, 4),
  ADD COLUMN IF NOT EXISTS materials_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS materials_confirmed_by uuid REFERENCES public.employees (id) ON DELETE SET NULL;

ALTER TABLE public.task_material_lines
  DROP CONSTRAINT IF EXISTS task_material_lines_consumed_non_negative;

ALTER TABLE public.task_material_lines
  ADD CONSTRAINT task_material_lines_consumed_non_negative CHECK (
    quantity_consumed IS NULL OR quantity_consumed >= 0
  );

ALTER TABLE public.task_material_lines
  DROP CONSTRAINT IF EXISTS task_material_lines_returned_non_negative;

ALTER TABLE public.task_material_lines
  ADD CONSTRAINT task_material_lines_returned_non_negative CHECK (
    quantity_returned IS NULL OR quantity_returned >= 0
  );

COMMENT ON COLUMN public.task_material_lines.quantity_consumed IS
  'Cantidad consumida al cierre (Materiales 1.3). NULL hasta confirmación.';

COMMENT ON COLUMN public.task_material_lines.quantity_returned IS
  'Cantidad devuelta al cierre = reservado - consumido (Materiales 1.3).';

CREATE OR REPLACE FUNCTION public.task_has_active_catalog_material_lines(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_material_lines l
    WHERE l.task_id = p_task_id
      AND l.status IN (
        'planned'::public.task_material_line_status,
        'reserved'::public.task_material_line_status
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.task_has_reserved_catalog_material_lines(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_material_lines l
    WHERE l.task_id = p_task_id
      AND l.status = 'reserved'::public.task_material_line_status
  );
$$;

CREATE OR REPLACE FUNCTION public.materials_consumed_exceeds_reserved_message(
  p_reserved numeric,
  p_consumed numeric,
  p_unit text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format(
    'La cantidad utilizada no puede superar los %s %s reservados.',
    trim(to_char(p_reserved, 'FM999999990.####')),
    trim(p_unit)
  );
$$;

CREATE OR REPLACE FUNCTION public.materials_validate_consumed_quantity(
  p_unit text,
  p_reserved numeric,
  p_consumed numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit text := lower(trim(coalesce(p_unit, '')));
BEGIN
  IF p_consumed IS NULL OR p_consumed < 0 THEN
    RAISE EXCEPTION 'La cantidad utilizada no puede ser negativa.';
  END IF;

  IF p_consumed > p_reserved THEN
    RAISE EXCEPTION '%',
      public.materials_consumed_exceeds_reserved_message(p_reserved, p_consumed, p_unit);
  END IF;

  IF v_unit IN ('un', 'pza', 'pzas', 'pieza', 'piezas', 'u', 'unidad', 'unidades')
     AND p_consumed <> trunc(p_consumed) THEN
    RAISE EXCEPTION 'Para Piezas la cantidad utilizada debe ser un número entero.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_task_material_consumption(
  p_task_id uuid,
  p_use_all boolean DEFAULT false,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_employee_id uuid := public.auth_user_employee_id();
  v_task public.tasks%ROWTYPE;
  v_line public.task_material_lines%ROWTYPE;
  v_input record;
  v_consumed numeric;
  v_returned numeric;
  v_reserved numeric;
  v_stock public.material_stock_levels%ROWTYPE;
  v_movement public.material_movements%ROWTYPE;
  v_processed_ids uuid[] := ARRAY[]::uuid[];
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_access_task_material_lines() THEN
    RAISE EXCEPTION 'No tiene permiso para confirmar materiales de la OT.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
    AND company_id = v_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada.';
  END IF;

  IF v_task.status NOT IN ('pendiente-cierre', 'en-aprobacion') THEN
    RAISE EXCEPTION 'Los materiales solo pueden confirmarse con la OT pendiente de cierre.';
  END IF;

  IF NOT public.task_has_reserved_catalog_material_lines(p_task_id) THEN
    RETURN jsonb_build_object(
      'taskId', p_task_id,
      'skipped', true,
      'reason', 'NO_RESERVED_LINES',
      'lines', '[]'::jsonb
    );
  END IF;

  IF p_use_all THEN
    FOR v_line IN
      SELECT l.*
      FROM public.task_material_lines l
      WHERE l.task_id = p_task_id
        AND l.company_id = v_company_id
        AND l.status = 'reserved'::public.task_material_line_status
      ORDER BY l.created_at
      FOR UPDATE
    LOOP
      v_consumed := v_line.quantity_planned;
      v_returned := 0;
      v_reserved := v_line.quantity_planned;

      PERFORM public.materials_validate_consumed_quantity(
        v_line.unit,
        v_reserved,
        v_consumed
      );

      v_stock := public.lock_material_stock_level(
        v_company_id,
        v_line.material_id,
        v_line.warehouse_id
      );

      IF v_stock.quantity_reserved < v_reserved THEN
        RAISE EXCEPTION 'La reserva del depósito es insuficiente para confirmar el consumo.';
      END IF;

      IF v_consumed > 0 AND v_stock.quantity_available < v_consumed THEN
        RAISE EXCEPTION 'Stock físico insuficiente para registrar el consumo.';
      END IF;

      UPDATE public.material_stock_levels
      SET
        quantity_available = quantity_available - v_consumed,
        quantity_reserved = quantity_reserved - v_reserved,
        updated_at = now()
      WHERE id = v_stock.id;

      IF v_consumed > 0 THEN
        INSERT INTO public.material_movements (
          company_id,
          material_id,
          warehouse_id,
          movement_type,
          quantity,
          notes,
          reference_type,
          reference_id,
          created_by
        )
        VALUES (
          v_company_id,
          v_line.material_id,
          v_line.warehouse_id,
          'consumption'::public.material_movement_type,
          v_consumed,
          format('Consumo OT %s', coalesce(v_task.code, p_task_id::text)),
          'task',
          p_task_id,
          v_employee_id
        )
        RETURNING * INTO v_movement;
      END IF;

      IF v_returned > 0 THEN
        INSERT INTO public.material_movements (
          company_id,
          material_id,
          warehouse_id,
          movement_type,
          quantity,
          notes,
          reference_type,
          reference_id,
          created_by
        )
        VALUES (
          v_company_id,
          v_line.material_id,
          v_line.warehouse_id,
          'return'::public.material_movement_type,
          v_returned,
          format('Devolución OT %s (liberación de reserva)', coalesce(v_task.code, p_task_id::text)),
          'task',
          p_task_id,
          v_employee_id
        );
      END IF;

      UPDATE public.task_material_lines
      SET
        quantity_consumed = v_consumed,
        quantity_returned = v_returned,
        materials_confirmed_at = now(),
        materials_confirmed_by = v_employee_id,
        status = 'consumed'::public.task_material_line_status,
        updated_at = now()
      WHERE id = v_line.id;

      v_processed_ids := array_append(v_processed_ids, v_line.id);
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'lineId', v_line.id,
          'quantityConsumed', v_consumed,
          'quantityReturned', v_returned
        )
      );
    END LOOP;
  ELSE
    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
      RAISE EXCEPTION 'Debe indicar las cantidades utilizadas.';
    END IF;

    FOR v_input IN
      SELECT
        (elem->>'lineId')::uuid AS line_id,
        (elem->>'quantityConsumed')::numeric AS quantity_consumed
      FROM jsonb_array_elements(p_lines) AS elem
    LOOP
      IF v_input.line_id IS NULL THEN
        RAISE EXCEPTION 'Línea de material inválida.';
      END IF;

      SELECT *
      INTO v_line
      FROM public.task_material_lines
      WHERE id = v_input.line_id
        AND task_id = p_task_id
        AND company_id = v_company_id
        AND status = 'reserved'::public.task_material_line_status
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea de material no encontrada o sin reserva activa.';
      END IF;

      IF v_line.id = ANY (v_processed_ids) THEN
        RAISE EXCEPTION 'Línea de material duplicada en la confirmación.';
      END IF;

      v_reserved := v_line.quantity_planned;
      v_consumed := coalesce(v_input.quantity_consumed, 0);
      v_returned := v_reserved - v_consumed;

      PERFORM public.materials_validate_consumed_quantity(
        v_line.unit,
        v_reserved,
        v_consumed
      );

      v_stock := public.lock_material_stock_level(
        v_company_id,
        v_line.material_id,
        v_line.warehouse_id
      );

      IF v_stock.quantity_reserved < v_reserved THEN
        RAISE EXCEPTION 'La reserva del depósito es insuficiente para confirmar el consumo.';
      END IF;

      IF v_consumed > 0 AND v_stock.quantity_available < v_consumed THEN
        RAISE EXCEPTION 'Stock físico insuficiente para registrar el consumo.';
      END IF;

      UPDATE public.material_stock_levels
      SET
        quantity_available = quantity_available - v_consumed,
        quantity_reserved = quantity_reserved - v_reserved,
        updated_at = now()
      WHERE id = v_stock.id;

      IF v_consumed > 0 THEN
        INSERT INTO public.material_movements (
          company_id,
          material_id,
          warehouse_id,
          movement_type,
          quantity,
          notes,
          reference_type,
          reference_id,
          created_by
        )
        VALUES (
          v_company_id,
          v_line.material_id,
          v_line.warehouse_id,
          'consumption'::public.material_movement_type,
          v_consumed,
          format('Consumo OT %s', coalesce(v_task.code, p_task_id::text)),
          'task',
          p_task_id,
          v_employee_id
        );
      END IF;

      IF v_returned > 0 THEN
        INSERT INTO public.material_movements (
          company_id,
          material_id,
          warehouse_id,
          movement_type,
          quantity,
          notes,
          reference_type,
          reference_id,
          created_by
        )
        VALUES (
          v_company_id,
          v_line.material_id,
          v_line.warehouse_id,
          'return'::public.material_movement_type,
          v_returned,
          format('Devolución OT %s (liberación de reserva)', coalesce(v_task.code, p_task_id::text)),
          'task',
          p_task_id,
          v_employee_id
        );
      END IF;

      UPDATE public.task_material_lines
      SET
        quantity_consumed = v_consumed,
        quantity_returned = v_returned,
        materials_confirmed_at = now(),
        materials_confirmed_by = v_employee_id,
        status = 'consumed'::public.task_material_line_status,
        updated_at = now()
      WHERE id = v_line.id;

      v_processed_ids := array_append(v_processed_ids, v_line.id);
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'lineId', v_line.id,
          'quantityConsumed', v_consumed,
          'quantityReturned', v_returned
        )
      );
    END LOOP;

    IF (
      SELECT count(*)
      FROM public.task_material_lines l
      WHERE l.task_id = p_task_id
        AND l.company_id = v_company_id
        AND l.status = 'reserved'::public.task_material_line_status
    ) > 0 THEN
      RAISE EXCEPTION 'Debe confirmar todas las líneas reservadas de la OT.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'taskId', p_task_id,
    'skipped', false,
    'lines', v_results
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_tasks_material_finalize_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'finalizada'
     AND public.task_has_reserved_catalog_material_lines(NEW.id) THEN
    RAISE EXCEPTION 'MATERIAL_CONSUMPTION_REQUIRED: Debe confirmar los materiales utilizados antes de finalizar la OT.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_material_finalize_guard_trg ON public.tasks;

CREATE TRIGGER tasks_material_finalize_guard_trg
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_tasks_material_finalize_guard();

COMMENT ON FUNCTION public.confirm_task_material_consumption(uuid, boolean, jsonb) IS
  'Confirma consumo/devolución de materiales reservados al cierre. No-op si no hay reservas.';

COMMENT ON FUNCTION public.task_has_active_catalog_material_lines(uuid) IS
  'True si la OT tiene líneas de catálogo activas (planned/reserved). Fuente única para activar flujo inventario.';
