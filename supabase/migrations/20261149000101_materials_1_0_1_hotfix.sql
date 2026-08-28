-- Materiales 1.0.1 — Hotfix: depósito inicial obligatorio al crear material + stock level siempre.

DROP FUNCTION IF EXISTS public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean
);

CREATE OR REPLACE FUNCTION public.create_material(
  p_code text,
  p_name text,
  p_category text,
  p_unit text,
  p_min_stock numeric DEFAULT 0,
  p_type public.material_item_type DEFAULT 'consumable',
  p_manufacturer text DEFAULT '',
  p_description text DEFAULT '',
  p_active boolean DEFAULT true,
  p_initial_warehouse_id uuid DEFAULT NULL
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
  v_active_count integer;
  v_warehouse_id uuid;
  v_warehouse public.warehouses%ROWTYPE;
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

  SELECT count(*)::integer INTO v_active_count
  FROM public.warehouses
  WHERE company_id = v_company_id
    AND active = true;

  IF v_active_count = 0 THEN
    RAISE EXCEPTION 'No hay depósitos activos. Cree un depósito antes de cargar materiales.';
  END IF;

  IF p_initial_warehouse_id IS NOT NULL THEN
    v_warehouse_id := p_initial_warehouse_id;
  ELSIF v_active_count = 1 THEN
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE company_id = v_company_id
      AND active = true
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Debe indicar el depósito inicial.';
  END IF;

  SELECT * INTO v_warehouse
  FROM public.warehouses
  WHERE id = v_warehouse_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND OR v_warehouse.active = false THEN
    RAISE EXCEPTION 'Depósito inicial no encontrado o inactivo.';
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
    v_warehouse_id,
    0,
    0
  );

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
    'initialWarehouseId', v_warehouse_id,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
END;
$$;

COMMENT ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid
) IS
  'Creates a catalog material and initial stock level (0) in the selected or sole active warehouse.';

REVOKE ALL ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid
) TO authenticated, service_role;
