-- Allow removing a commercial catalog item even if its TV component
-- was already taken out of the catalog (logical delete). The previous
-- trigger required a live TV plan on every UPDATE, so Eliminar failed
-- with "El componente TV requiere un plan TV existente."
-- Does not CASCADE customers, isp_services, billing or TV API.

CREATE OR REPLACE FUNCTION public.enforce_isp_catalog_tv_plan_component()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.isp_service_catalog%ROWTYPE;
BEGIN
  IF NEW.category = 'tv' THEN
    NEW.tv_plan_catalog_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tv_plan_catalog_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tv_plan_catalog_id = NEW.id THEN
    RAISE EXCEPTION 'El componente TV no puede referenciar el mismo servicio.';
  END IF;

  SELECT *
    INTO v_plan
  FROM public.isp_service_catalog
  WHERE id = NEW.tv_plan_catalog_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    NEW.tv_plan_catalog_id := NULL;
    RETURN NEW;
  END IF;

  IF v_plan.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El servicio no puede usar un plan TV de otra empresa.';
  END IF;

  IF v_plan.category IS DISTINCT FROM 'tv' THEN
    RAISE EXCEPTION 'El componente TV debe ser un plan de categoría TV.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_isp_catalog_tv_plan_component() IS
  'Validates optional TV component on live catalog rows. Soft-delete and dangling TV refs do not block removing a commercial offer from the catalog.';
