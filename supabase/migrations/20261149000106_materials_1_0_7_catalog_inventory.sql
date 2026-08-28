-- Materiales 1.0.7 — Separación catálogo / inventario.

-- Limpieza segura: stock levels huérfanos (0/0 sin movimientos en ese depósito).
DELETE FROM public.material_stock_levels sl
WHERE sl.quantity_available = 0
  AND sl.quantity_reserved = 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.material_movements m
    WHERE m.company_id = sl.company_id
      AND m.material_id = sl.material_id
      AND (
        m.warehouse_id = sl.warehouse_id
        OR m.destination_warehouse_id = sl.warehouse_id
      )
  );

DROP FUNCTION IF EXISTS public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid
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

  IF EXISTS (
    SELECT 1
    FROM public.materials
    WHERE company_id = v_company_id
      AND code = v_code
      AND active = true
  ) THEN
    RAISE EXCEPTION
      'Ya existe un material activo con el código %. Buscálo en el catálogo y registrá el stock mediante Entrada.',
      v_code;
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

COMMENT ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean
) IS
  'Crea un material en catálogo sin stock level ni movimiento. El inventario inicia con Registrar entrada.';

REVOKE ALL ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean
) TO authenticated, service_role;
