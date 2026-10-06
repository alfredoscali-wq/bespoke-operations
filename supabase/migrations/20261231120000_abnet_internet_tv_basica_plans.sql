-- ABNet only: four Internet + TV Básica commercial plans.
-- Inserts new isp_service_catalog rows. Does not update existing plans,
-- TV plans, customers, contracted services, or work orders.
-- legacy_plan_code is the new catalog code, never 20Mb/50Mb/100Mb/300Mb.

DO $$
DECLARE
  v_company uuid := '00000000-0000-4000-8000-000000000002';
  v_tv_count integer;
  v_ready integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = v_company
  ) THEN
    RAISE EXCEPTION 'No se encontró la empresa ABNet.';
  END IF;

  SELECT count(*)
    INTO v_tv_count
  FROM public.isp_service_catalog
  WHERE company_id = v_company
    AND deleted_at IS NULL
    AND is_active = true
    AND category = 'tv'
    AND lower(btrim(code)) = 'tv-basico';

  IF v_tv_count <> 1 THEN
    RAISE EXCEPTION
      'ABNet debe tener exactamente un plan TV-BASICO activo. Encontrados: %.',
      v_tv_count;
  END IF;

  SELECT count(*)
    INTO v_ready
  FROM (
    VALUES
      ('WIRELESS-20', 'WIRELESS-20-IP'),
      ('FTTH-50', 'FTTH-50'),
      ('FTTH-100', 'FTTH-100'),
      ('FTTH-300', 'FTTH-300')
  ) AS required(base_code, profile_code)
  WHERE (
    SELECT count(*)
    FROM public.isp_service_catalog base
    WHERE base.company_id = v_company
      AND base.deleted_at IS NULL
      AND lower(btrim(base.code)) = lower(required.base_code)
  ) = 1
  AND (
    SELECT count(*)
    FROM public.isp_technical_profiles profile
    WHERE profile.company_id = v_company
      AND profile.deleted_at IS NULL
      AND profile.is_active = true
      AND lower(btrim(profile.code)) = lower(required.profile_code)
  ) = 1;

  IF v_ready <> 4 THEN
    RAISE EXCEPTION
      'ABNet no tiene los planes base o perfiles técnicos activos esperados.';
  END IF;

  INSERT INTO public.isp_service_catalog (
    company_id,
    name,
    code,
    external_code,
    category,
    customer_type,
    is_active,
    technology,
    download_speed_mbps,
    upload_speed_mbps,
    speed_unit,
    monthly_price,
    currency,
    price_is_configurable,
    billing_period,
    billing_method,
    requires_connection,
    allowed_connection_types,
    ot_label,
    legacy_plan_code,
    is_seed,
    technical_profile_id,
    tv_plan_catalog_id
  )
  SELECT
    v_company,
    seed.name,
    seed.code,
    seed.code,
    'internet',
    'residential',
    true,
    seed.technology,
    seed.download_speed_mbps,
    seed.upload_speed_mbps,
    'mbps',
    seed.monthly_price,
    'ARS',
    true,
    'monthly',
    base.billing_method,
    base.requires_connection,
    base.allowed_connection_types,
    seed.name,
    seed.code,
    false,
    profile.id,
    tv.id
  FROM (
    VALUES
      (
        'WIRELESS-20-TV-BASICO'::text,
        '20 Megas + TV Básica'::text,
        'wireless'::text,
        20,
        10,
        32800.00,
        'WIRELESS-20'::text,
        'WIRELESS-20-IP'::text
      ),
      (
        'FTTH-50-TV-BASICO'::text,
        '50 Megas + TV Básica'::text,
        'ftth'::text,
        50,
        50,
        35300.00,
        'FTTH-50'::text,
        'FTTH-50'::text
      ),
      (
        'FTTH-100-TV-BASICO'::text,
        '100 Megas + TV Básica'::text,
        'ftth'::text,
        100,
        100,
        39300.00,
        'FTTH-100'::text,
        'FTTH-100'::text
      ),
      (
        'FTTH-300-TV-BASICO'::text,
        '300 Megas + TV Básica'::text,
        'ftth'::text,
        300,
        300,
        44300.00,
        'FTTH-300'::text,
        'FTTH-300'::text
      )
  ) AS seed(
    code,
    name,
    technology,
    download_speed_mbps,
    upload_speed_mbps,
    monthly_price,
    base_code,
    profile_code
  )
  JOIN public.isp_service_catalog base
    ON base.company_id = v_company
   AND base.deleted_at IS NULL
   AND lower(btrim(base.code)) = lower(seed.base_code)
  JOIN public.isp_technical_profiles profile
    ON profile.company_id = v_company
   AND profile.deleted_at IS NULL
   AND profile.is_active = true
   AND lower(btrim(profile.code)) = lower(seed.profile_code)
  JOIN public.isp_service_catalog tv
    ON tv.company_id = v_company
   AND tv.deleted_at IS NULL
   AND tv.is_active = true
   AND tv.category = 'tv'
   AND lower(btrim(tv.code)) = 'tv-basico'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.isp_service_catalog existing
    WHERE existing.company_id = v_company
      AND existing.deleted_at IS NULL
      AND (
        lower(btrim(COALESCE(existing.code, ''))) = lower(seed.code)
        OR lower(btrim(existing.name)) = lower(seed.name)
        OR lower(btrim(COALESCE(existing.legacy_plan_code, ''))) = lower(seed.code)
      )
  );

  IF (
    SELECT count(*)
    FROM public.isp_service_catalog
    WHERE company_id = v_company
      AND deleted_at IS NULL
      AND code IN (
        'WIRELESS-20-TV-BASICO',
        'FTTH-50-TV-BASICO',
        'FTTH-100-TV-BASICO',
        'FTTH-300-TV-BASICO'
      )
      AND legacy_plan_code IN (
        'WIRELESS-20-TV-BASICO',
        'FTTH-50-TV-BASICO',
        'FTTH-100-TV-BASICO',
        'FTTH-300-TV-BASICO'
      )
      AND legacy_plan_code NOT IN ('20Mb', '50Mb', '100Mb', '300Mb')
  ) <> 4 THEN
    RAISE EXCEPTION 'No quedaron los 4 abonos Internet + TV Básica de ABNet.';
  END IF;
END $$;
