-- Materiales 1.0 — Inventario real: depósitos, catálogo, stock por depósito y movimientos.

CREATE TYPE public.material_item_type AS ENUM ('consumable', 'equipment');

CREATE TYPE public.material_movement_type AS ENUM (
  'entry',
  'exit',
  'transfer',
  'adjustment'
);

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouses_name_not_blank CHECK (char_length(trim(name)) > 0),
  CONSTRAINT warehouses_company_name_unique UNIQUE (company_id, name)
);

CREATE INDEX warehouses_company_active_idx
  ON public.warehouses (company_id, active, name);

COMMENT ON TABLE public.warehouses IS
  'Depósitos / almacenes de inventario por empresa.';

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL,
  min_stock numeric(18, 4) NOT NULL DEFAULT 0
    CHECK (min_stock >= 0),
  type public.material_item_type NOT NULL DEFAULT 'consumable',
  active boolean NOT NULL DEFAULT true,
  manufacturer text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materials_code_not_blank CHECK (char_length(trim(code)) > 0),
  CONSTRAINT materials_name_not_blank CHECK (char_length(trim(name)) > 0),
  CONSTRAINT materials_unit_not_blank CHECK (char_length(trim(unit)) > 0),
  CONSTRAINT materials_category_check CHECK (
    category IN (
      'fiber-optic',
      'cameras',
      'wireless',
      'pole-infrastructure',
      'network-equipment',
      'consumables'
    )
  ),
  CONSTRAINT materials_company_code_unique UNIQUE (company_id, code)
);

CREATE INDEX materials_company_active_idx
  ON public.materials (company_id, active, code);

COMMENT ON TABLE public.materials IS
  'Catálogo de materiales y equipos por empresa.';

CREATE TABLE public.material_stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  material_id uuid NOT NULL REFERENCES public.materials (id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  quantity_available numeric(18, 4) NOT NULL DEFAULT 0
    CHECK (quantity_available >= 0),
  quantity_reserved numeric(18, 4) NOT NULL DEFAULT 0
    CHECK (quantity_reserved >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_stock_levels_material_warehouse_unique
    UNIQUE (material_id, warehouse_id),
  CONSTRAINT material_stock_levels_reserved_le_available CHECK (
    quantity_reserved <= quantity_available
  )
);

CREATE INDEX material_stock_levels_company_material_idx
  ON public.material_stock_levels (company_id, material_id);

CREATE INDEX material_stock_levels_company_warehouse_idx
  ON public.material_stock_levels (company_id, warehouse_id);

COMMENT ON TABLE public.material_stock_levels IS
  'Stock físico por material y depósito. quantity_available es stock en mano; quantity_reserved reservas futuras (OT).';

CREATE TABLE public.material_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  material_id uuid NOT NULL REFERENCES public.materials (id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  destination_warehouse_id uuid REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  movement_type public.material_movement_type NOT NULL,
  quantity numeric(18, 4) NOT NULL,
  notes text NOT NULL DEFAULT '',
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_movements_quantity_positive CHECK (quantity > 0),
  CONSTRAINT material_movements_transfer_destination_check CHECK (
    movement_type <> 'transfer'
    OR destination_warehouse_id IS NOT NULL
      AND destination_warehouse_id IS DISTINCT FROM warehouse_id
  ),
  CONSTRAINT material_movements_non_transfer_no_destination CHECK (
    movement_type = 'transfer'
    OR destination_warehouse_id IS NULL
  )
);

CREATE INDEX material_movements_company_material_created_idx
  ON public.material_movements (company_id, material_id, created_at DESC);

CREATE INDEX material_movements_company_created_idx
  ON public.material_movements (company_id, created_at DESC);

COMMENT ON TABLE public.material_movements IS
  'Historial de movimientos de inventario. Los cambios de stock se aplican vía RPC transaccional.';

CREATE OR REPLACE FUNCTION public.set_materials_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER warehouses_set_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_materials_updated_at();

CREATE TRIGGER materials_set_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_materials_updated_at();

CREATE TRIGGER material_stock_levels_set_updated_at
  BEFORE UPDATE ON public.material_stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_materials_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_material_stock_level_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_material_company uuid;
  v_warehouse_company uuid;
BEGIN
  SELECT company_id INTO v_material_company
  FROM public.materials
  WHERE id = NEW.material_id;

  SELECT company_id INTO v_warehouse_company
  FROM public.warehouses
  WHERE id = NEW.warehouse_id;

  IF v_material_company IS NULL OR v_warehouse_company IS NULL THEN
    RAISE EXCEPTION 'Material o depósito no encontrado.';
  END IF;

  IF v_material_company IS DISTINCT FROM NEW.company_id
    OR v_warehouse_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El stock debe pertenecer a la misma empresa que el material y el depósito.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER material_stock_levels_enforce_company_match
  BEFORE INSERT OR UPDATE ON public.material_stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.enforce_material_stock_level_company_match();

CREATE OR REPLACE FUNCTION public.enforce_material_movement_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_material_company uuid;
  v_warehouse_company uuid;
  v_destination_company uuid;
BEGIN
  SELECT company_id INTO v_material_company
  FROM public.materials
  WHERE id = NEW.material_id;

  SELECT company_id INTO v_warehouse_company
  FROM public.warehouses
  WHERE id = NEW.warehouse_id;

  IF NEW.destination_warehouse_id IS NOT NULL THEN
    SELECT company_id INTO v_destination_company
    FROM public.warehouses
    WHERE id = NEW.destination_warehouse_id;
  END IF;

  IF v_material_company IS NULL OR v_warehouse_company IS NULL THEN
    RAISE EXCEPTION 'Material o depósito no encontrado.';
  END IF;

  IF v_material_company IS DISTINCT FROM NEW.company_id
    OR v_warehouse_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El movimiento debe pertenecer a la misma empresa.';
  END IF;

  IF NEW.destination_warehouse_id IS NOT NULL
    AND v_destination_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El depósito destino debe pertenecer a la misma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER material_movements_enforce_company_match
  BEFORE INSERT ON public.material_movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_material_movement_company_match();

CREATE OR REPLACE FUNCTION public.auth_can_manage_materials()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_has_allowed_module('materials')
    AND NOT public.auth_is_demo_platform_read_only();
$$;

COMMENT ON FUNCTION public.auth_can_manage_materials() IS
  'True when authenticated user may mutate materials inventory (module access, not demo read-only).';

CREATE OR REPLACE FUNCTION public.materials_net_available(
  p_quantity_available numeric,
  p_quantity_reserved numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(p_quantity_available - p_quantity_reserved, 0);
$$;

CREATE OR REPLACE FUNCTION public.lock_material_stock_level(
  p_company_id uuid,
  p_material_id uuid,
  p_warehouse_id uuid
)
RETURNS public.material_stock_levels
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.material_stock_levels%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.material_stock_levels
  WHERE company_id = p_company_id
    AND material_id = p_material_id
    AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe stock para este material en el depósito seleccionado.';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_material_stock_level(
  p_company_id uuid,
  p_material_id uuid,
  p_warehouse_id uuid
)
RETURNS public.material_stock_levels
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.material_stock_levels%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.material_stock_levels
  WHERE company_id = p_company_id
    AND material_id = p_material_id
    AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.material_stock_levels (
    company_id,
    material_id,
    warehouse_id,
    quantity_available,
    quantity_reserved
  )
  VALUES (
    p_company_id,
    p_material_id,
    p_warehouse_id,
    0,
    0
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_warehouse(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_name text := trim(p_name);
  v_row public.warehouses%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para administrar depósitos.';
  END IF;

  IF char_length(v_name) = 0 THEN
    RAISE EXCEPTION 'El nombre del depósito es obligatorio.';
  END IF;

  INSERT INTO public.warehouses (company_id, name)
  VALUES (v_company_id, v_name)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'companyId', v_row.company_id,
    'name', v_row.name,
    'active', v_row.active,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_warehouse(
  p_warehouse_id uuid,
  p_name text DEFAULT NULL,
  p_active boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_name text := NULLIF(trim(p_name), '');
  v_row public.warehouses%ROWTYPE;
  v_has_stock boolean;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para administrar depósitos.';
  END IF;

  SELECT * INTO v_row
  FROM public.warehouses
  WHERE id = p_warehouse_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Depósito no encontrado.';
  END IF;

  IF p_active IS NOT NULL AND p_active = false AND v_row.active = true THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.material_stock_levels
      WHERE company_id = v_company_id
        AND warehouse_id = p_warehouse_id
        AND (
          quantity_available > 0
          OR quantity_reserved > 0
        )
    ) INTO v_has_stock;

    IF v_has_stock THEN
      RAISE EXCEPTION 'No se puede desactivar un depósito con stock.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.material_movements
      WHERE company_id = v_company_id
        AND (
          warehouse_id = p_warehouse_id
          OR destination_warehouse_id = p_warehouse_id
        )
    ) THEN
      RAISE EXCEPTION 'No se puede desactivar un depósito con movimientos registrados.';
    END IF;
  END IF;

  UPDATE public.warehouses
  SET
    name = COALESCE(v_name, name),
    active = COALESCE(p_active, active),
    updated_at = now()
  WHERE id = p_warehouse_id
    AND company_id = v_company_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'companyId', v_row.company_id,
    'name', v_row.name,
    'active', v_row.active,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_material(
  p_code text,
  p_name text,
  p_category text,
  p_unit text,
  p_min_stock numeric DEFAULT 0,
  p_type public.material_item_type DEFAULT 'consumable',
  p_manufacturer text DEFAULT '',
  p_description text DEFAULT '',
  p_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_code text := trim(p_code);
  v_name text := trim(p_name);
  v_unit text := trim(p_unit);
  v_row public.materials%ROWTYPE;
  v_single_warehouse_id uuid;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para administrar materiales.';
  END IF;

  IF char_length(v_code) = 0 OR char_length(v_name) = 0 OR char_length(v_unit) = 0 THEN
    RAISE EXCEPTION 'Código, nombre y unidad son obligatorios.';
  END IF;

  IF p_min_stock IS NULL OR p_min_stock < 0 THEN
    RAISE EXCEPTION 'El stock mínimo no puede ser negativo.';
  END IF;

  INSERT INTO public.materials (
    company_id,
    code,
    name,
    category,
    unit,
    min_stock,
    type,
    manufacturer,
    description,
    active
  )
  VALUES (
    v_company_id,
    v_code,
    v_name,
    p_category,
    v_unit,
    p_min_stock,
    p_type,
    COALESCE(p_manufacturer, ''),
    COALESCE(p_description, ''),
    COALESCE(p_active, true)
  )
  RETURNING * INTO v_row;

  SELECT w.id INTO v_single_warehouse_id
  FROM public.warehouses w
  WHERE w.company_id = v_company_id
    AND w.active = true
  ORDER BY w.created_at ASC, w.id ASC
  LIMIT 1;

  IF (
    SELECT count(*)
    FROM public.warehouses
    WHERE company_id = v_company_id
      AND active = true
  ) = 1 AND v_single_warehouse_id IS NOT NULL THEN
    INSERT INTO public.material_stock_levels (
      company_id,
      material_id,
      warehouse_id,
      quantity_available,
      quantity_reserved
    )
    VALUES (
      v_company_id,
      v_row.id,
      v_single_warehouse_id,
      0,
      0
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'companyId', v_row.company_id,
    'code', v_row.code,
    'name', v_row.name,
    'category', v_row.category,
    'unit', v_row.unit,
    'minStock', v_row.min_stock,
    'type', v_row.type,
    'manufacturer', v_row.manufacturer,
    'description', v_row.description,
    'active', v_row.active,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_material(
  p_material_id uuid,
  p_code text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_unit text DEFAULT NULL,
  p_min_stock numeric DEFAULT NULL,
  p_type public.material_item_type DEFAULT NULL,
  p_manufacturer text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_active boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_code text := NULLIF(trim(p_code), '');
  v_name text := NULLIF(trim(p_name), '');
  v_unit text := NULLIF(trim(p_unit), '');
  v_row public.materials%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para administrar materiales.';
  END IF;

  SELECT * INTO v_row
  FROM public.materials
  WHERE id = p_material_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material no encontrado.';
  END IF;

  IF p_min_stock IS NOT NULL AND p_min_stock < 0 THEN
    RAISE EXCEPTION 'El stock mínimo no puede ser negativo.';
  END IF;

  UPDATE public.materials
  SET
    code = COALESCE(v_code, code),
    name = COALESCE(v_name, name),
    category = COALESCE(p_category, category),
    unit = COALESCE(v_unit, unit),
    min_stock = COALESCE(p_min_stock, min_stock),
    type = COALESCE(p_type, type),
    manufacturer = COALESCE(p_manufacturer, manufacturer),
    description = COALESCE(p_description, description),
    active = COALESCE(p_active, active),
    updated_at = now()
  WHERE id = p_material_id
    AND company_id = v_company_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'companyId', v_row.company_id,
    'code', v_row.code,
    'name', v_row.name,
    'category', v_row.category,
    'unit', v_row.unit,
    'minStock', v_row.min_stock,
    'type', v_row.type,
    'manufacturer', v_row.manufacturer,
    'description', v_row.description,
    'active', v_row.active,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_material_stock_entry(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_employee_id uuid := public.auth_user_employee_id();
  v_stock public.material_stock_levels%ROWTYPE;
  v_warehouse public.warehouses%ROWTYPE;
  v_movement public.material_movements%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para registrar movimientos.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
  END IF;

  SELECT * INTO v_warehouse
  FROM public.warehouses
  WHERE id = p_warehouse_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND OR v_warehouse.active = false THEN
    RAISE EXCEPTION 'Depósito no encontrado o inactivo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.materials
    WHERE id = p_material_id
      AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Material no encontrado.';
  END IF;

  v_stock := public.ensure_material_stock_level(
    v_company_id,
    p_material_id,
    p_warehouse_id
  );

  UPDATE public.material_stock_levels
  SET
    quantity_available = quantity_available + p_quantity,
    updated_at = now()
  WHERE id = v_stock.id
  RETURNING * INTO v_stock;

  INSERT INTO public.material_movements (
    company_id,
    material_id,
    warehouse_id,
    movement_type,
    quantity,
    notes,
    created_by
  )
  VALUES (
    v_company_id,
    p_material_id,
    p_warehouse_id,
    'entry',
    p_quantity,
    COALESCE(p_notes, ''),
    v_employee_id
  )
  RETURNING * INTO v_movement;

  RETURN jsonb_build_object(
    'movementId', v_movement.id,
    'stockLevelId', v_stock.id,
    'quantityAvailable', v_stock.quantity_available,
    'quantityReserved', v_stock.quantity_reserved
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_material_stock_exit(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_employee_id uuid := public.auth_user_employee_id();
  v_stock public.material_stock_levels%ROWTYPE;
  v_warehouse public.warehouses%ROWTYPE;
  v_net numeric;
  v_movement public.material_movements%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para registrar movimientos.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
  END IF;

  SELECT * INTO v_warehouse
  FROM public.warehouses
  WHERE id = p_warehouse_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND OR v_warehouse.active = false THEN
    RAISE EXCEPTION 'Depósito no encontrado o inactivo.';
  END IF;

  v_stock := public.lock_material_stock_level(
    v_company_id,
    p_material_id,
    p_warehouse_id
  );

  v_net := public.materials_net_available(
    v_stock.quantity_available,
    v_stock.quantity_reserved
  );

  IF p_quantity > v_net THEN
    RAISE EXCEPTION 'Stock disponible insuficiente para la salida.';
  END IF;

  UPDATE public.material_stock_levels
  SET
    quantity_available = quantity_available - p_quantity,
    updated_at = now()
  WHERE id = v_stock.id
  RETURNING * INTO v_stock;

  INSERT INTO public.material_movements (
    company_id,
    material_id,
    warehouse_id,
    movement_type,
    quantity,
    notes,
    created_by
  )
  VALUES (
    v_company_id,
    p_material_id,
    p_warehouse_id,
    'exit',
    p_quantity,
    COALESCE(p_notes, ''),
    v_employee_id
  )
  RETURNING * INTO v_movement;

  RETURN jsonb_build_object(
    'movementId', v_movement.id,
    'stockLevelId', v_stock.id,
    'quantityAvailable', v_stock.quantity_available,
    'quantityReserved', v_stock.quantity_reserved
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_material_stock_transfer(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_destination_warehouse_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_employee_id uuid := public.auth_user_employee_id();
  v_origin_stock public.material_stock_levels%ROWTYPE;
  v_destination_stock public.material_stock_levels%ROWTYPE;
  v_origin_warehouse public.warehouses%ROWTYPE;
  v_destination_warehouse public.warehouses%ROWTYPE;
  v_net numeric;
  v_movement public.material_movements%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para registrar movimientos.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
  END IF;

  IF p_destination_warehouse_id IS NULL
    OR p_destination_warehouse_id = p_warehouse_id THEN
    RAISE EXCEPTION 'Debe indicar un depósito destino distinto.';
  END IF;

  SELECT * INTO v_origin_warehouse
  FROM public.warehouses
  WHERE id = p_warehouse_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND OR v_origin_warehouse.active = false THEN
    RAISE EXCEPTION 'Depósito origen no encontrado o inactivo.';
  END IF;

  SELECT * INTO v_destination_warehouse
  FROM public.warehouses
  WHERE id = p_destination_warehouse_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND OR v_destination_warehouse.active = false THEN
    RAISE EXCEPTION 'Depósito destino no encontrado o inactivo.';
  END IF;

  v_origin_stock := public.lock_material_stock_level(
    v_company_id,
    p_material_id,
    p_warehouse_id
  );

  v_net := public.materials_net_available(
    v_origin_stock.quantity_available,
    v_origin_stock.quantity_reserved
  );

  IF p_quantity > v_net THEN
    RAISE EXCEPTION 'Stock disponible insuficiente para la transferencia.';
  END IF;

  v_destination_stock := public.ensure_material_stock_level(
    v_company_id,
    p_material_id,
    p_destination_warehouse_id
  );

  UPDATE public.material_stock_levels
  SET
    quantity_available = quantity_available - p_quantity,
    updated_at = now()
  WHERE id = v_origin_stock.id
  RETURNING * INTO v_origin_stock;

  UPDATE public.material_stock_levels
  SET
    quantity_available = quantity_available + p_quantity,
    updated_at = now()
  WHERE id = v_destination_stock.id
  RETURNING * INTO v_destination_stock;

  INSERT INTO public.material_movements (
    company_id,
    material_id,
    warehouse_id,
    destination_warehouse_id,
    movement_type,
    quantity,
    notes,
    created_by
  )
  VALUES (
    v_company_id,
    p_material_id,
    p_warehouse_id,
    p_destination_warehouse_id,
    'transfer',
    p_quantity,
    COALESCE(p_notes, ''),
    v_employee_id
  )
  RETURNING * INTO v_movement;

  RETURN jsonb_build_object(
    'movementId', v_movement.id,
    'originStockLevelId', v_origin_stock.id,
    'destinationStockLevelId', v_destination_stock.id,
    'originQuantityAvailable', v_origin_stock.quantity_available,
    'destinationQuantityAvailable', v_destination_stock.quantity_available
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_material_stock_adjustment(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_new_quantity numeric,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_employee_id uuid := public.auth_user_employee_id();
  v_stock public.material_stock_levels%ROWTYPE;
  v_warehouse public.warehouses%ROWTYPE;
  v_delta numeric;
  v_movement public.material_movements%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_can_manage_materials() THEN
    RAISE EXCEPTION 'No tiene permiso para registrar movimientos.';
  END IF;

  IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
    RAISE EXCEPTION 'El stock ajustado no puede ser negativo.';
  END IF;

  SELECT * INTO v_warehouse
  FROM public.warehouses
  WHERE id = p_warehouse_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND OR v_warehouse.active = false THEN
    RAISE EXCEPTION 'Depósito no encontrado o inactivo.';
  END IF;

  v_stock := public.ensure_material_stock_level(
    v_company_id,
    p_material_id,
    p_warehouse_id
  );

  IF p_new_quantity < v_stock.quantity_reserved THEN
    RAISE EXCEPTION 'El stock ajustado no puede ser menor que las reservas.';
  END IF;

  v_delta := p_new_quantity - v_stock.quantity_available;

  IF v_delta = 0 THEN
    RAISE EXCEPTION 'El stock ya coincide con el valor indicado.';
  END IF;

  UPDATE public.material_stock_levels
  SET
    quantity_available = p_new_quantity,
    updated_at = now()
  WHERE id = v_stock.id
  RETURNING * INTO v_stock;

  INSERT INTO public.material_movements (
    company_id,
    material_id,
    warehouse_id,
    movement_type,
    quantity,
    notes,
    created_by
  )
  VALUES (
    v_company_id,
    p_material_id,
    p_warehouse_id,
    'adjustment',
    abs(v_delta),
    COALESCE(p_notes, ''),
    v_employee_id
  )
  RETURNING * INTO v_movement;

  RETURN jsonb_build_object(
    'movementId', v_movement.id,
    'stockLevelId', v_stock.id,
    'quantityAvailable', v_stock.quantity_available,
    'quantityReserved', v_stock.quantity_reserved,
    'delta', v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_warehouse(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_warehouse(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_warehouse(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_warehouse(uuid, text, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_material(
  uuid, text, text, text, text, numeric, public.material_item_type, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_material(
  uuid, text, text, text, text, numeric, public.material_item_type, text, text, boolean
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_material_stock_entry(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_material_stock_entry(uuid, uuid, numeric, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_material_stock_exit(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_material_stock_exit(uuid, uuid, numeric, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_material_stock_transfer(uuid, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_material_stock_transfer(uuid, uuid, uuid, numeric, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_material_stock_adjustment(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_material_stock_adjustment(uuid, uuid, numeric, text) TO authenticated, service_role;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouses_select_policy
  ON public.warehouses
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('materials')
  );

CREATE POLICY warehouses_insert_policy
  ON public.warehouses
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  );

CREATE POLICY warehouses_update_policy
  ON public.warehouses
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  );

CREATE POLICY materials_select_policy
  ON public.materials
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('materials')
  );

CREATE POLICY materials_insert_policy
  ON public.materials
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  );

CREATE POLICY materials_update_policy
  ON public.materials
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  );

CREATE POLICY material_stock_levels_select_policy
  ON public.material_stock_levels
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('materials')
  );

CREATE POLICY material_stock_levels_insert_policy
  ON public.material_stock_levels
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  );

CREATE POLICY material_stock_levels_update_policy
  ON public.material_stock_levels
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  );

CREATE POLICY material_movements_select_policy
  ON public.material_movements
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('materials')
  );

CREATE POLICY material_movements_insert_policy
  ON public.material_movements
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_materials()
  );
