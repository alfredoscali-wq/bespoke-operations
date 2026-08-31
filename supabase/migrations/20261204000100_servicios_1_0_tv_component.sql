-- SERVICIOS 1.0 — optional TV component on a commercial catalog service.
-- Stored on isp_service_catalog (the sellable commercial offering), not on
-- isp_services (the contracted instance). A contracted service inherits the
-- component later via: isp_services.catalog_id → tv_plan_catalog_id → TV plan.
-- The commercial item remains a single abono. TV is an internal component.
-- Does not change billing, SIRO, Excel import, Clientes 360 UI or /subscriptions.

ALTER TABLE public.isp_service_catalog
  ADD COLUMN IF NOT EXISTS tv_plan_catalog_id uuid
    REFERENCES public.isp_service_catalog (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.isp_service_catalog.tv_plan_catalog_id IS
  'Optional TV component: FK to another isp_service_catalog row of category=tv in the same company. Not a second invoice. Commercial monthly_price stays independent. Existing rows without TV stay NULL.';

CREATE INDEX IF NOT EXISTS isp_service_catalog_tv_plan_idx
  ON public.isp_service_catalog (company_id, tv_plan_catalog_id)
  WHERE deleted_at IS NULL AND tv_plan_catalog_id IS NOT NULL;

-- SECURITY DEFINER so the trigger can read the target plan across tenants and
-- reject a cross-company FK. RLS on isp_service_catalog already scopes
-- SELECT/INSERT/UPDATE to auth_user_company_id(); this is an extra server guard.
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
    RAISE EXCEPTION 'El componente TV requiere un plan TV existente.';
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

DROP TRIGGER IF EXISTS isp_service_catalog_enforce_tv_plan_component
  ON public.isp_service_catalog;

CREATE TRIGGER isp_service_catalog_enforce_tv_plan_component
  BEFORE INSERT OR UPDATE ON public.isp_service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_catalog_tv_plan_component();
