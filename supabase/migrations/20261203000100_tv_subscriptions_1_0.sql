-- TV & Suscripciones 1.0 — desk over Clientes 360 / isp_services.
-- Seeds three TV catalog plans. Does not drop the prototype subscription_* tables.
-- Does not change billing runs, SIRO or Internet catalog prices.

COMMENT ON TABLE public.subscription_services IS
  'DEPRECATED prototype catalog (Bespoke TV 1.0). TV 1.0 uses isp_service_catalog category=tv. Do not use for new assignments.';
COMMENT ON TABLE public.subscription_customers IS
  'DEPRECATED prototype subscriber padrones. TV 1.0 uses customers + isp_services. Do not use for new assignments.';
COMMENT ON TABLE public.subscription_sales IS
  'DEPRECATED prototype TV sales/proration. TV is billed with the Internet abono; not a separate collection.';
COMMENT ON TABLE public.subscription_commissions IS
  'DEPRECATED prototype seller commissions for TV pre-altas. Not part of TV 1.0.';

INSERT INTO public.isp_service_catalog (
  company_id,
  name,
  code,
  category,
  customer_type,
  description,
  is_active,
  technology,
  monthly_price,
  currency,
  price_is_configurable,
  billing_period,
  billing_method,
  requires_connection,
  allowed_connection_types,
  is_seed
)
SELECT
  c.id,
  seed.name,
  seed.code,
  'tv',
  'both',
  seed.description,
  true,
  NULL,
  seed.monthly_price,
  'ARS',
  true,
  'monthly',
  'siro',
  false,
  '{}'::text[],
  true
FROM public.companies c
CROSS JOIN (
  VALUES
    (
      'TV Básico',
      'TV-BASICO',
      4500.00,
      'Plan TV Básico. Se cobra junto con el abono mensual de Internet.'
    ),
    (
      'TV Básico + Pack Fútbol',
      'TV-BASICO-FUTBOL',
      7500.00,
      'Plan TV Básico con Pack Fútbol. Se cobra junto con el abono mensual de Internet.'
    ),
    (
      'TV Full',
      'TV-FULL',
      9900.00,
      'Plan TV Full. Se cobra junto con el abono mensual de Internet.'
    )
) AS seed(name, code, monthly_price, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.isp_service_catalog existing
  WHERE existing.company_id = c.id
    AND existing.deleted_at IS NULL
    AND (
      lower(existing.name) = lower(seed.name)
      OR lower(COALESCE(existing.code, '')) = lower(seed.code)
    )
);

UPDATE public.isp_service_catalog
SET
  category = 'tv',
  monthly_price = 4500.00,
  billing_method = 'siro',
  requires_connection = false,
  allowed_connection_types = '{}'::text[],
  code = COALESCE(NULLIF(btrim(code), ''), 'TV-BASICO'),
  customer_type = COALESCE(customer_type, 'both'),
  is_active = true
WHERE deleted_at IS NULL
  AND (
    lower(name) = 'tv básico'
    OR lower(COALESCE(code, '')) = 'tv-basico'
  );

UPDATE public.isp_service_catalog
SET
  category = 'tv',
  monthly_price = 7500.00,
  billing_method = 'siro',
  requires_connection = false,
  allowed_connection_types = '{}'::text[],
  code = COALESCE(NULLIF(btrim(code), ''), 'TV-BASICO-FUTBOL'),
  customer_type = COALESCE(customer_type, 'both'),
  is_active = true
WHERE deleted_at IS NULL
  AND (
    lower(name) = 'tv básico + pack fútbol'
    OR lower(COALESCE(code, '')) = 'tv-basico-futbol'
  );

UPDATE public.isp_service_catalog
SET
  category = 'tv',
  monthly_price = 9900.00,
  billing_method = 'siro',
  requires_connection = false,
  allowed_connection_types = '{}'::text[],
  code = COALESCE(NULLIF(btrim(code), ''), 'TV-FULL'),
  customer_type = COALESCE(customer_type, 'both'),
  is_active = true
WHERE deleted_at IS NULL
  AND (
    lower(name) = 'tv full'
    OR lower(COALESCE(code, '')) = 'tv-full'
  );

CREATE INDEX IF NOT EXISTS isp_services_company_catalog_status_idx
  ON public.isp_services (company_id, catalog_id, commercial_status)
  WHERE deleted_at IS NULL;

-- At most one current TV plan per customer (active or pending activation).
-- Plan changes later: cancel the previous TV service, then insert the new one
-- with replaced_service_id pointing at the old row.
CREATE OR REPLACE FUNCTION public.enforce_one_active_tv_service()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_category text;
  v_other uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.commercial_status NOT IN ('active', 'pending_activation') THEN
    RETURN NEW;
  END IF;

  IF NEW.catalog_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT category
    INTO v_category
  FROM public.isp_service_catalog
  WHERE id = NEW.catalog_id
    AND deleted_at IS NULL;

  IF v_category IS DISTINCT FROM 'tv' THEN
    RETURN NEW;
  END IF;

  SELECT s.id
    INTO v_other
  FROM public.isp_services s
  INNER JOIN public.isp_service_catalog c ON c.id = s.catalog_id
  WHERE s.company_id = NEW.company_id
    AND s.customer_id = NEW.customer_id
    AND s.deleted_at IS NULL
    AND s.commercial_status IN ('active', 'pending_activation')
    AND s.id IS DISTINCT FROM NEW.id
    AND c.category = 'tv'
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'El cliente ya tiene un servicio TV vigente.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS isp_services_enforce_one_active_tv
  ON public.isp_services;

CREATE TRIGGER isp_services_enforce_one_active_tv
  BEFORE INSERT OR UPDATE ON public.isp_services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_one_active_tv_service();

DROP POLICY IF EXISTS isp_service_catalog_select_policy ON public.isp_service_catalog;
CREATE POLICY isp_service_catalog_select_policy
  ON public.isp_service_catalog
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('clientes_360')
      OR public.auth_user_has_allowed_module('work_orders')
      OR public.auth_user_has_allowed_module('subscriptions')
    )
  );

DROP POLICY IF EXISTS isp_services_select_policy ON public.isp_services;
CREATE POLICY isp_services_select_policy
  ON public.isp_services
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('clientes_360')
      OR public.auth_user_has_allowed_module('subscriptions')
    )
  );
