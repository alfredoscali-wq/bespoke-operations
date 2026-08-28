-- Materiales 1.0.4 — Foto de catálogo + módulo attachments.

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_module_check;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_module_check CHECK (
    module IN (
      'customer_attention',
      'commercial',
      'projects',
      'tasks',
      'employees',
      'customers',
      'materials'
    )
  );

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS photo_attachment_id uuid
    REFERENCES public.attachments (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.materials.photo_attachment_id IS
  'Foto opcional del material en catálogo (adjunto module=materials).';

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

REVOKE ALL ON FUNCTION public.update_material(
  uuid, text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_material(
  uuid, text, text, text, text, numeric, public.material_item_type, text, text, boolean, uuid, boolean
) TO authenticated, service_role;
