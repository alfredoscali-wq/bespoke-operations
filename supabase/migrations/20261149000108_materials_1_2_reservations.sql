-- Materiales 1.2 — Reservas de stock por OT (sin consumo físico).

ALTER TYPE public.task_material_line_status ADD VALUE IF NOT EXISTS 'reserved';

COMMENT ON TYPE public.task_material_line_status IS
  'planned: sin reserva; reserved: stock reservado; cancelled: línea liberada o eliminada.';

CREATE OR REPLACE FUNCTION public.materials_insufficient_stock_message(
  p_available numeric,
  p_requested numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format(
    'Stock insuficiente: disponible %s, solicitado %s',
    trim(to_char(p_available, 'FM999999990.####')),
    trim(to_char(p_requested, 'FM999999990.####'))
  );
$$;

CREATE OR REPLACE FUNCTION public.task_should_immediately_reserve_material(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.deleted_at IS NULL
      AND t.status IN (
        'asignada',
        'vencida',
        'en-curso',
        'incidencia',
        'pendiente-cierre',
        'en-aprobacion'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.task_has_reserved_material_lines(p_task_id uuid)
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

CREATE OR REPLACE FUNCTION public.assert_material_reservation_entities(
  p_company_id uuid,
  p_material_id uuid,
  p_warehouse_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_material_active boolean;
  v_warehouse_active boolean;
BEGIN
  SELECT m.active
  INTO v_material_active
  FROM public.materials m
  WHERE m.id = p_material_id
    AND m.company_id = p_company_id;

  IF NOT FOUND OR NOT v_material_active THEN
    RAISE EXCEPTION 'Material no encontrado en el catálogo.';
  END IF;

  SELECT w.active
  INTO v_warehouse_active
  FROM public.warehouses w
  WHERE w.id = p_warehouse_id
    AND w.company_id = p_company_id;

  IF NOT FOUND OR NOT v_warehouse_active THEN
    RAISE EXCEPTION 'Depósito no encontrado o inactivo.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_material_stock_reservation_delta(
  p_company_id uuid,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_delta numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock public.material_stock_levels%ROWTYPE;
  v_net numeric;
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  PERFORM public.assert_material_reservation_entities(
    p_company_id,
    p_material_id,
    p_warehouse_id
  );

  v_stock := public.lock_material_stock_level(
    p_company_id,
    p_material_id,
    p_warehouse_id
  );

  IF p_delta > 0 THEN
    v_net := public.materials_net_available(
      v_stock.quantity_available,
      v_stock.quantity_reserved
    );

    IF v_net < p_delta THEN
      RAISE EXCEPTION '%',
        public.materials_insufficient_stock_message(v_net, p_delta);
    END IF;

    UPDATE public.material_stock_levels
    SET
      quantity_reserved = quantity_reserved + p_delta,
      updated_at = now()
    WHERE id = v_stock.id;
  ELSE
    IF v_stock.quantity_reserved + p_delta < 0 THEN
      RAISE EXCEPTION 'La reserva del depósito no puede quedar negativa.';
    END IF;

    UPDATE public.material_stock_levels
    SET
      quantity_reserved = quantity_reserved + p_delta,
      updated_at = now()
    WHERE id = v_stock.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_task_material_line_internal(p_line_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_line public.task_material_lines%ROWTYPE;
BEGIN
  SELECT *
  INTO v_line
  FROM public.task_material_lines
  WHERE id = p_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de material no encontrada.';
  END IF;

  IF v_line.status <> 'planned'::public.task_material_line_status THEN
    RETURN;
  END IF;

  PERFORM public.apply_material_stock_reservation_delta(
    v_line.company_id,
    v_line.material_id,
    v_line.warehouse_id,
    v_line.quantity_planned
  );

  UPDATE public.task_material_lines
  SET
    status = 'reserved'::public.task_material_line_status,
    updated_at = now()
  WHERE id = p_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_task_material_line_internal(
  p_line_id uuid,
  p_cancel_line boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_line public.task_material_lines%ROWTYPE;
BEGIN
  SELECT *
  INTO v_line
  FROM public.task_material_lines
  WHERE id = p_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de material no encontrada.';
  END IF;

  IF v_line.status <> 'reserved'::public.task_material_line_status THEN
    RETURN;
  END IF;

  PERFORM public.apply_material_stock_reservation_delta(
    v_line.company_id,
    v_line.material_id,
    v_line.warehouse_id,
    -v_line.quantity_planned
  );

  IF p_cancel_line THEN
    UPDATE public.task_material_lines
    SET
      status = 'cancelled'::public.task_material_line_status,
      updated_at = now()
    WHERE id = p_line_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_task_material_lines_for_task(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_line record;
  v_line_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.auth_can_access_task_material_lines() THEN
    RAISE EXCEPTION 'No tiene permiso para gestionar reservas de materiales.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada.';
  END IF;

  IF v_task.company_id IS DISTINCT FROM public.auth_user_company_id() THEN
    RAISE EXCEPTION 'Operación no permitida para esta empresa.';
  END IF;

  FOR v_line IN
    SELECT l.id
    FROM public.task_material_lines l
    WHERE l.task_id = p_task_id
      AND l.company_id = v_task.company_id
      AND l.status = 'planned'::public.task_material_line_status
    ORDER BY l.material_id, l.warehouse_id, l.created_at
    FOR UPDATE
  LOOP
    PERFORM public.reserve_task_material_line_internal(v_line.id);
    v_line_ids := array_append(v_line_ids, v_line.id);
  END LOOP;

  RETURN jsonb_build_object(
    'taskId', p_task_id,
    'reservedLineIds', to_jsonb(v_line_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_all_task_material_reservations(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_line record;
  v_line_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.auth_can_access_task_material_lines() THEN
    RAISE EXCEPTION 'No tiene permiso para gestionar reservas de materiales.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada.';
  END IF;

  IF v_task.company_id IS DISTINCT FROM public.auth_user_company_id() THEN
    RAISE EXCEPTION 'Operación no permitida para esta empresa.';
  END IF;

  FOR v_line IN
    SELECT l.id
    FROM public.task_material_lines l
    WHERE l.task_id = p_task_id
      AND l.company_id = v_task.company_id
      AND l.status = 'reserved'::public.task_material_line_status
    ORDER BY l.material_id, l.warehouse_id, l.created_at
    FOR UPDATE
  LOOP
    PERFORM public.release_task_material_line_internal(v_line.id, true);
    v_line_ids := array_append(v_line_ids, v_line.id);
  END LOOP;

  RETURN jsonb_build_object(
    'taskId', p_task_id,
    'releasedLineIds', to_jsonb(v_line_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_task_material_line_with_reservation(
  p_task_id uuid,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_quantity_planned numeric,
  p_unit text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_line public.task_material_lines%ROWTYPE;
  v_reserved boolean := false;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_access_task_material_lines() THEN
    RAISE EXCEPTION 'No tiene permiso para gestionar materiales de OT.';
  END IF;

  IF p_quantity_planned IS NULL OR p_quantity_planned <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
  END IF;

  IF char_length(trim(coalesce(p_unit, ''))) = 0 THEN
    RAISE EXCEPTION 'La unidad es obligatoria.';
  END IF;

  PERFORM 1
  FROM public.tasks t
  WHERE t.id = p_task_id
    AND t.company_id = v_company_id
    AND t.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada.';
  END IF;

  PERFORM public.assert_material_reservation_entities(
    v_company_id,
    p_material_id,
    p_warehouse_id
  );

  INSERT INTO public.task_material_lines (
    company_id,
    task_id,
    material_id,
    warehouse_id,
    quantity_planned,
    unit,
    notes,
    status
  )
  VALUES (
    v_company_id,
    p_task_id,
    p_material_id,
    p_warehouse_id,
    p_quantity_planned,
    trim(p_unit),
    nullif(trim(coalesce(p_notes, '')), ''),
    'planned'::public.task_material_line_status
  )
  RETURNING * INTO v_line;

  IF public.task_should_immediately_reserve_material(p_task_id) THEN
    PERFORM public.reserve_task_material_line_internal(v_line.id);
    v_reserved := true;

    SELECT * INTO v_line
    FROM public.task_material_lines
    WHERE id = v_line.id;
  END IF;

  RETURN jsonb_build_object(
    'line', to_jsonb(v_line),
    'reservationAction', CASE WHEN v_reserved THEN 'created' ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_task_material_line_with_reservation(
  p_task_id uuid,
  p_line_id uuid,
  p_quantity_planned numeric DEFAULT NULL,
  p_warehouse_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_line public.task_material_lines%ROWTYPE;
  v_next_qty numeric;
  v_next_wh uuid;
  v_delta numeric;
  v_reservation_action text := NULL;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_access_task_material_lines() THEN
    RAISE EXCEPTION 'No tiene permiso para gestionar materiales de OT.';
  END IF;

  SELECT *
  INTO v_line
  FROM public.task_material_lines
  WHERE id = p_line_id
    AND task_id = p_task_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de material no encontrada.';
  END IF;

  IF v_line.status = 'cancelled'::public.task_material_line_status THEN
    RAISE EXCEPTION 'No se puede editar una línea cancelada.';
  END IF;

  v_next_qty := coalesce(p_quantity_planned, v_line.quantity_planned);
  v_next_wh := coalesce(p_warehouse_id, v_line.warehouse_id);

  IF v_next_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
  END IF;

  PERFORM public.assert_material_reservation_entities(
    v_company_id,
    v_line.material_id,
    v_next_wh
  );

  IF v_line.status = 'planned'::public.task_material_line_status THEN
    UPDATE public.task_material_lines
    SET
      quantity_planned = v_next_qty,
      warehouse_id = v_next_wh,
      notes = CASE
        WHEN p_notes IS NULL THEN notes
        ELSE nullif(trim(p_notes), '')
      END,
      updated_at = now()
    WHERE id = p_line_id
    RETURNING * INTO v_line;

    IF public.task_should_immediately_reserve_material(p_task_id) THEN
      PERFORM public.reserve_task_material_line_internal(v_line.id);
      v_reservation_action := 'created';

      SELECT * INTO v_line
      FROM public.task_material_lines
      WHERE id = p_line_id;
    END IF;

    RETURN jsonb_build_object(
      'line', to_jsonb(v_line),
      'reservationAction', v_reservation_action
    );
  END IF;

  IF v_line.status = 'reserved'::public.task_material_line_status THEN
    IF v_next_wh IS DISTINCT FROM v_line.warehouse_id THEN
      PERFORM public.release_task_material_line_internal(v_line.id, false);

      PERFORM public.apply_material_stock_reservation_delta(
        v_company_id,
        v_line.material_id,
        v_next_wh,
        v_next_qty
      );

      UPDATE public.task_material_lines
      SET
        quantity_planned = v_next_qty,
        warehouse_id = v_next_wh,
        notes = CASE
          WHEN p_notes IS NULL THEN notes
          ELSE nullif(trim(p_notes), '')
        END,
        updated_at = now()
      WHERE id = p_line_id
      RETURNING * INTO v_line;

      v_reservation_action := 'updated';
    ELSE
      v_delta := v_next_qty - v_line.quantity_planned;

      IF v_delta > 0 THEN
        PERFORM public.apply_material_stock_reservation_delta(
          v_company_id,
          v_line.material_id,
          v_line.warehouse_id,
          v_delta
        );
        v_reservation_action := 'updated';
      ELSIF v_delta < 0 THEN
        PERFORM public.apply_material_stock_reservation_delta(
          v_company_id,
          v_line.material_id,
          v_line.warehouse_id,
          v_delta
        );
        v_reservation_action := 'released';
      END IF;

      UPDATE public.task_material_lines
      SET
        quantity_planned = v_next_qty,
        notes = CASE
          WHEN p_notes IS NULL THEN notes
          ELSE nullif(trim(p_notes), '')
        END,
        updated_at = now()
      WHERE id = p_line_id
      RETURNING * INTO v_line;
    END IF;

    RETURN jsonb_build_object(
      'line', to_jsonb(v_line),
      'reservationAction', v_reservation_action
    );
  END IF;

  RAISE EXCEPTION 'Estado de línea no soportado.';
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_task_material_lines_for_task_internal(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
BEGIN
  FOR v_line IN
    SELECT l.id
    FROM public.task_material_lines l
    JOIN public.tasks t ON t.id = l.task_id
    WHERE l.task_id = p_task_id
      AND l.company_id = t.company_id
      AND t.deleted_at IS NULL
      AND l.status = 'planned'::public.task_material_line_status
    ORDER BY l.material_id, l.warehouse_id, l.created_at
    FOR UPDATE OF l
  LOOP
    PERFORM public.reserve_task_material_line_internal(v_line.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_all_task_material_reservations_internal(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
BEGIN
  FOR v_line IN
    SELECT l.id
    FROM public.task_material_lines l
    JOIN public.tasks t ON t.id = l.task_id
    WHERE l.task_id = p_task_id
      AND l.company_id = t.company_id
      AND l.status = 'reserved'::public.task_material_line_status
    ORDER BY l.material_id, l.warehouse_id, l.created_at
    FOR UPDATE OF l
  LOOP
    PERFORM public.release_task_material_line_internal(v_line.id, true);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_task_material_line_with_reservation(
  p_task_id uuid,
  p_line_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_line public.task_material_lines%ROWTYPE;
  v_released boolean := false;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_access_task_material_lines() THEN
    RAISE EXCEPTION 'No tiene permiso para gestionar materiales de OT.';
  END IF;

  SELECT *
  INTO v_line
  FROM public.task_material_lines
  WHERE id = p_line_id
    AND task_id = p_task_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de material no encontrada.';
  END IF;

  IF v_line.status = 'reserved'::public.task_material_line_status THEN
    PERFORM public.release_task_material_line_internal(v_line.id, false);
    v_released := true;
  END IF;

  DELETE FROM public.task_material_lines
  WHERE id = p_line_id;

  RETURN jsonb_build_object(
    'lineId', p_line_id,
    'reservationAction', CASE WHEN v_released THEN 'released' ELSE NULL END,
    'line', to_jsonb(v_line)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_tasks_material_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      PERFORM public.release_all_task_material_reservations_internal(NEW.id);
      RETURN NEW;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'asignada' AND OLD.status IS DISTINCT FROM 'asignada' THEN
        PERFORM public.reserve_task_material_lines_for_task_internal(NEW.id);
      ELSIF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN
        PERFORM public.release_all_task_material_reservations_internal(NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_material_reservations_trg ON public.tasks;

CREATE TRIGGER tasks_material_reservations_trg
  AFTER UPDATE OF status, deleted_at ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_tasks_material_reservations();

COMMENT ON FUNCTION public.reserve_task_material_lines_for_task(uuid) IS
  'Reserva todas las líneas planificadas de una OT. Usado al pasar a asignada.';

COMMENT ON FUNCTION public.release_all_task_material_reservations(uuid) IS
  'Libera reservas activas de una OT (cancelación o eliminación).';
