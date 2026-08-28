-- Materiales 1.0.6 — Códigos reutilizables tras eliminación lógica + validación amigable.

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_company_code_unique;

CREATE UNIQUE INDEX IF NOT EXISTS materials_company_active_code_unique
  ON public.materials (company_id, code)
  WHERE active = true;

COMMENT ON INDEX public.materials_company_active_code_unique IS
  'Código único por empresa solo entre materiales activos; inactivos permiten reutilizar el código.';

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
  p_active boolean DEFAULT NULL,
  p_photo_attachment_id uuid DEFAULT NULL,
  p_clear_photo boolean DEFAULT false
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

  IF v_code IS NOT NULL AND v_code IS DISTINCT FROM v_row.code THEN
    IF EXISTS (
      SELECT 1
      FROM public.materials
      WHERE company_id = v_company_id
        AND code = v_code
        AND active = true
        AND id <> p_material_id
    ) THEN
      RAISE EXCEPTION
        'Ya existe un material activo con el código %. Buscálo en el catálogo y registrá el stock mediante Entrada.',
        v_code;
    END IF;
  END IF;

  IF p_photo_attachment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.attachments
      WHERE id = p_photo_attachment_id
        AND company_id = v_company_id
        AND module = 'materials'
        AND record_id = p_material_id
    ) THEN
      RAISE EXCEPTION 'La foto no corresponde a este material.';
    END IF;
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
    photo_attachment_id = CASE
      WHEN p_clear_photo THEN NULL
      WHEN p_photo_attachment_id IS NOT NULL THEN p_photo_attachment_id
      ELSE photo_attachment_id
    END,
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
    'photoAttachmentId', v_row.photo_attachment_id,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_material(
  text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_material(
  uuid, text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_material(
  uuid, text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid, boolean
) TO authenticated, service_role;
