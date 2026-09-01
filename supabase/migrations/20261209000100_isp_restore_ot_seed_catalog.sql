-- Restore the four catalog plans required by new-installation OTs.
-- Logical delete (deleted_at) hid them from Servicios and from the OT form.
-- Do not overwrite monthly_price, names or existing IDs (tasks / isp_services FKs).
-- Do not CASCADE. Do not touch TV plans, billing, SIRO or the Excel importer.

UPDATE public.isp_service_catalog
SET
  deleted_at = NULL,
  is_active = true,
  updated_at = now()
WHERE (
  code IN ('FTTH-50', 'FTTH-100', 'FTTH-300', 'WIRELESS-20')
  OR legacy_plan_code IN ('50Mb', '100Mb', '300Mb', '20Mb')
)
AND (deleted_at IS NOT NULL OR is_active = false);

UPDATE public.isp_technical_profiles
SET
  deleted_at = NULL,
  is_active = true,
  updated_at = now()
WHERE code IN ('FTTH-50', 'FTTH-100', 'FTTH-300', 'WIRELESS-20-IP')
  AND (deleted_at IS NOT NULL OR is_active = false);

INSERT INTO public.isp_technical_profiles (
  company_id,
  code,
  name,
  description,
  technology,
  connection_type,
  download_speed,
  upload_speed,
  speed_unit,
  core_name,
  core_profile_id,
  is_active
)
SELECT
  c.id,
  seed.code,
  seed.name,
  'Perfil técnico de referencia. Sin integración con el Core.',
  seed.technology,
  seed.connection_type,
  seed.download_speed,
  seed.upload_speed,
  'mbps',
  'MikroTik',
  seed.core_profile_id,
  true
FROM public.companies c
CROSS JOIN (
  VALUES
    ('FTTH-50', 'Perfil FTTH 50 Mb', 'ftth', 'pppoe', 50::integer, NULL::integer, 'FTTH-50'),
    ('FTTH-100', 'Perfil FTTH 100 Mb', 'ftth', 'pppoe', 100::integer, NULL::integer, 'FTTH-100'),
    ('FTTH-300', 'Perfil FTTH 300 Mb', 'ftth', 'pppoe', 300::integer, NULL::integer, 'FTTH-300'),
    ('WIRELESS-20-IP', 'Perfil Wireless 20 Mb IP', 'wireless', 'static_ip', 20::integer, NULL::integer, 'WIRELESS-20-IP')
) AS seed(
  code,
  name,
  technology,
  connection_type,
  download_speed,
  upload_speed,
  core_profile_id
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.isp_technical_profiles existing
  WHERE existing.company_id = c.id
    AND lower(existing.code) = lower(seed.code)
);

INSERT INTO public.isp_service_catalog (
  company_id,
  name,
  code,
  external_code,
  category,
  customer_type,
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
  is_active,
  is_seed,
  description
)
SELECT
  c.id,
  seed.name,
  seed.code,
  seed.code,
  'internet',
  'residential',
  seed.technology,
  seed.download_speed_mbps,
  NULL::integer,
  'mbps',
  NULL::numeric,
  'ARS',
  true,
  'monthly',
  'siro',
  true,
  seed.allowed_connection_types,
  seed.ot_label,
  seed.legacy_plan_code,
  true,
  true,
  'Dato inicial del catálogo. Completar precio y subida desde Servicios.'
FROM public.companies c
CROSS JOIN (
  VALUES
    (
      'FTTH 50 Mb',
      'FTTH-50',
      'ftth',
      50::integer,
      '50 Mb',
      '50Mb',
      ARRAY['pppoe', 'static_ip']::text[]
    ),
    (
      'FTTH 100 Mb',
      'FTTH-100',
      'ftth',
      100::integer,
      '100 Mb',
      '100Mb',
      ARRAY['pppoe', 'static_ip']::text[]
    ),
    (
      'FTTH 300 Mb',
      'FTTH-300',
      'ftth',
      300::integer,
      '300 Mb',
      '300Mb',
      ARRAY['pppoe', 'static_ip']::text[]
    ),
    (
      'Wireless 20 Mb',
      'WIRELESS-20',
      'wireless',
      20::integer,
      '20 Mb Wireless',
      '20Mb',
      ARRAY['static_ip']::text[]
    )
) AS seed(
  name,
  code,
  technology,
  download_speed_mbps,
  ot_label,
  legacy_plan_code,
  allowed_connection_types
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.isp_service_catalog existing
  WHERE existing.company_id = c.id
    AND (
      lower(COALESCE(existing.code, '')) = lower(seed.code)
      OR existing.legacy_plan_code = seed.legacy_plan_code
    )
);

UPDATE public.isp_service_catalog cat
SET technical_profile_id = p.id
FROM public.isp_technical_profiles p
WHERE cat.company_id = p.company_id
  AND cat.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND cat.technical_profile_id IS NULL
  AND (
    (cat.code = 'FTTH-50' AND p.code = 'FTTH-50')
    OR (cat.code = 'FTTH-100' AND p.code = 'FTTH-100')
    OR (cat.code = 'FTTH-300' AND p.code = 'FTTH-300')
    OR (cat.code = 'WIRELESS-20' AND p.code = 'WIRELESS-20-IP')
  );
