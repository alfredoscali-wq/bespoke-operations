-- Materiales 1.0.5 — Eliminación lógica del catálogo (soft delete vía active = false).

CREATE OR REPLACE FUNCTION public.delete_material(p_material_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_row public.materials%ROWTYPE;
  v_has_stock boolean;
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

  IF v_row.active = false THEN
    RAISE EXCEPTION 'El material ya fue eliminado del catálogo.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.material_stock_levels
    WHERE company_id = v_company_id
      AND material_id = p_material_id
      AND (
        quantity_available > 0
        OR quantity_reserved > 0
      )
  ) INTO v_has_stock;

  IF v_has_stock THEN
    RAISE EXCEPTION
      'No se puede eliminar un material con stock. Regularice el stock antes de eliminarlo del catálogo.';
  END IF;

  UPDATE public.materials
  SET
    active = false,
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

REVOKE ALL ON FUNCTION public.delete_material(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_material(uuid) TO authenticated, service_role;
