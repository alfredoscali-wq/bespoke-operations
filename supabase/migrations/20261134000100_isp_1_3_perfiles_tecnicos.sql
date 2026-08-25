-- ISP 1.3 — Configuración comercial y perfiles técnicos del catálogo.
-- Additive only. Does not rewrite prices, OT, Clientes 360°, migración or connections.
-- Core / MikroTik fields are configuration placeholders. No live integration.

CREATE TABLE IF NOT EXISTS public.isp_technical_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  technology text
    CHECK (technology IS NULL OR technology IN ('ftth', 'wireless', 'other')),
  connection_type text
    CHECK (
      connection_type IS NULL
      OR connection_type IN ('pppoe', 'static_ip', 'dhcp', 'l2l', 'dedicated', 'other')
    ),
  download_speed integer CHECK (download_speed IS NULL OR download_speed >= 0),
  upload_speed integer CHECK (upload_speed IS NULL OR upload_speed >= 0),
  speed_unit text NOT NULL DEFAULT 'mbps',
  core_name text,
  core_profile_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS isp_technical_profiles_company_code_idx
  ON public.isp_technical_profiles (company_id, lower(code))
  WHERE deleted_at IS NULL AND btrim(code) <> '';

CREATE INDEX IF NOT EXISTS isp_technical_profiles_company_active_idx
  ON public.isp_technical_profiles (company_id, is_active)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.isp_technical_profiles IS
  'Technical profile referenced by a commercial catalog item. Core/MikroTik fields are placeholders until ISP 1.6.';
COMMENT ON COLUMN public.isp_technical_profiles.core_name IS
  'Configured core name (e.g. MikroTik). Not a live connection.';
COMMENT ON COLUMN public.isp_technical_profiles.core_profile_id IS
  'Identifier of the profile in the core. Stored only; never provisioned in this sprint.';
COMMENT ON COLUMN public.isp_technical_profiles.speed_unit IS
  'Speed unit for download_speed/upload_speed. Default mbps; other units are allowed later.';

CREATE TRIGGER isp_technical_profiles_set_updated_at
  BEFORE UPDATE ON public.isp_technical_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

ALTER TABLE public.isp_technical_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_technical_profiles_select_policy
  ON public.isp_technical_profiles
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('clientes_360')
      OR public.auth_user_has_allowed_module('work_orders')
    )
  );

CREATE POLICY isp_technical_profiles_insert_policy
  ON public.isp_technical_profiles
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_technical_profiles_update_policy
  ON public.isp_technical_profiles
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.isp_technical_profiles TO authenticated;

ALTER TABLE public.isp_service_catalog
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE public.isp_service_catalog
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ARS';

ALTER TABLE public.isp_service_catalog
  ADD COLUMN IF NOT EXISTS price_is_configurable boolean NOT NULL DEFAULT true;

ALTER TABLE public.isp_service_catalog
  ADD COLUMN IF NOT EXISTS speed_unit text NOT NULL DEFAULT 'mbps';

ALTER TABLE public.isp_service_catalog
  ADD COLUMN IF NOT EXISTS technical_profile_id uuid
    REFERENCES public.isp_technical_profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.isp_service_catalog.code IS
  'Commercial Bespoke code unique per company (e.g. FTTH-100). Used to map ISP plan labels during onboarding.';
COMMENT ON COLUMN public.isp_service_catalog.currency IS
  'Currency of monthly_price. Default ARS; other currencies can be added later.';
COMMENT ON COLUMN public.isp_service_catalog.price_is_configurable IS
  'When true, administrators may edit the monthly subscription price.';
COMMENT ON COLUMN public.isp_service_catalog.speed_unit IS
  'Unit for download_speed_mbps/upload_speed_mbps. Default mbps; name kept for compatibility.';
COMMENT ON COLUMN public.isp_service_catalog.technical_profile_id IS
  'Optional technical profile that materializes this commercial service. No subscriber IP or PPPoE credentials.';

CREATE UNIQUE INDEX IF NOT EXISTS isp_service_catalog_company_code_idx
  ON public.isp_service_catalog (company_id, lower(code))
  WHERE deleted_at IS NULL AND code IS NOT NULL AND btrim(code) <> '';

CREATE INDEX IF NOT EXISTS isp_service_catalog_technical_profile_idx
  ON public.isp_service_catalog (company_id, technical_profile_id)
  WHERE deleted_at IS NULL AND technical_profile_id IS NOT NULL;

ALTER TABLE public.isp_service_catalog
  DROP CONSTRAINT IF EXISTS isp_service_catalog_category_check;

CREATE OR REPLACE FUNCTION public.enforce_isp_catalog_allowed_connection_types()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_type text;
BEGIN
  IF NEW.allowed_connection_types IS NULL THEN
    NEW.allowed_connection_types := '{}'::text[];
  END IF;

  FOREACH v_type IN ARRAY NEW.allowed_connection_types LOOP
    IF v_type NOT IN ('pppoe', 'static_ip', 'dhcp', 'l2l', 'dedicated', 'other') THEN
      RAISE EXCEPTION 'Tipo de conexión de catálogo inválido.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_isp_catalog_technical_profile_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile_company uuid;
BEGIN
  IF NEW.technical_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id
    INTO v_profile_company
  FROM public.isp_technical_profiles
  WHERE id = NEW.technical_profile_id
    AND deleted_at IS NULL;

  IF v_profile_company IS NULL THEN
    RAISE EXCEPTION 'El servicio requiere un perfil técnico existente.';
  END IF;

  IF v_profile_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El servicio no puede usar un perfil técnico de otra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS isp_service_catalog_enforce_technical_profile_company
  ON public.isp_service_catalog;

CREATE TRIGGER isp_service_catalog_enforce_technical_profile_company
  BEFORE INSERT OR UPDATE ON public.isp_service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_catalog_technical_profile_company_match();

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
    ('FTTH-50', 'Perfil FTTH 50 Mb', 'ftth', 'pppoe', 50, 50, 'FTTH-50'),
    ('FTTH-100', 'Perfil FTTH 100 Mb', 'ftth', 'pppoe', 100, 100, 'FTTH-100'),
    ('FTTH-300', 'Perfil FTTH 300 Mb', 'ftth', 'pppoe', 300, 300, 'FTTH-300'),
    ('WIRELESS-20-IP', 'Perfil Wireless 20 Mb IP', 'wireless', 'static_ip', 20, NULL, 'WIRELESS-20-IP')
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
    AND existing.deleted_at IS NULL
);

UPDATE public.isp_service_catalog cat
SET code = mapped.code
FROM (
  VALUES
    ('50Mb', 'FTTH-50'),
    ('100Mb', 'FTTH-100'),
    ('300Mb', 'FTTH-300'),
    ('20Mb', 'WIRELESS-20')
) AS mapped(legacy_plan_code, code)
WHERE cat.deleted_at IS NULL
  AND (cat.code IS NULL OR btrim(cat.code) = '')
  AND cat.legacy_plan_code = mapped.legacy_plan_code;

UPDATE public.isp_service_catalog
SET code = 'FTTH-50'
WHERE deleted_at IS NULL
  AND (code IS NULL OR btrim(code) = '')
  AND lower(name) = lower('FTTH 50 Mb');

UPDATE public.isp_service_catalog
SET code = 'FTTH-100'
WHERE deleted_at IS NULL
  AND (code IS NULL OR btrim(code) = '')
  AND lower(name) = lower('FTTH 100 Mb');

UPDATE public.isp_service_catalog
SET code = 'FTTH-300'
WHERE deleted_at IS NULL
  AND (code IS NULL OR btrim(code) = '')
  AND lower(name) = lower('FTTH 300 Mb');

UPDATE public.isp_service_catalog
SET code = 'WIRELESS-20'
WHERE deleted_at IS NULL
  AND (code IS NULL OR btrim(code) = '')
  AND lower(name) = lower('Wireless 20 Mb');

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

UPDATE public.isp_service_catalog
SET upload_speed_mbps = 50
WHERE deleted_at IS NULL
  AND upload_speed_mbps IS NULL
  AND code = 'FTTH-50';

UPDATE public.isp_service_catalog
SET upload_speed_mbps = 100
WHERE deleted_at IS NULL
  AND upload_speed_mbps IS NULL
  AND code = 'FTTH-100';

UPDATE public.isp_service_catalog
SET upload_speed_mbps = 300
WHERE deleted_at IS NULL
  AND upload_speed_mbps IS NULL
  AND code = 'FTTH-300';

UPDATE public.isp_service_catalog
SET external_code = code
WHERE deleted_at IS NULL
  AND code IS NOT NULL
  AND btrim(code) <> ''
  AND (external_code IS NULL OR btrim(external_code) = '');
