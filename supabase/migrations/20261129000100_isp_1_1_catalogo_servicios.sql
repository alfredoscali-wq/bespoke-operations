-- ISP 1.1 — Catálogo de servicios comerciales + referencia desde OT y servicios contratados.
-- Additive only. Does not rewrite historical OT, customers, tesorería or archivo OT.

CREATE TABLE public.isp_service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  name text NOT NULL,
  category text NOT NULL
    CHECK (category IN (
      'internet',
      'business',
      'connectivity',
      'tv',
      'cameras',
      'other'
    )),
  customer_type text NOT NULL
    CHECK (customer_type IN ('residential', 'business', 'both')),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  technology text
    CHECK (technology IS NULL OR technology IN ('ftth', 'wireless', 'other')),
  download_speed_mbps integer CHECK (download_speed_mbps IS NULL OR download_speed_mbps >= 0),
  upload_speed_mbps integer CHECK (upload_speed_mbps IS NULL OR upload_speed_mbps >= 0),
  monthly_price numeric(12, 2) CHECK (monthly_price IS NULL OR monthly_price >= 0),
  billing_period text NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly')),
  billing_method text NOT NULL DEFAULT 'siro'
    CHECK (billing_method IN ('siro')),
  requires_connection boolean NOT NULL DEFAULT true,
  allowed_connection_types text[] NOT NULL DEFAULT '{}'::text[],
  ot_label text,
  legacy_plan_code text,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX isp_service_catalog_company_name_idx
  ON public.isp_service_catalog (company_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX isp_service_catalog_company_active_idx
  ON public.isp_service_catalog (company_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX isp_service_catalog_company_technology_idx
  ON public.isp_service_catalog (company_id, technology)
  WHERE deleted_at IS NULL AND is_active = true;

COMMENT ON TABLE public.isp_service_catalog IS
  'Commercial ISP catalog: what the company sells. Monthly price is the subscription fee, never the OT charge.';
COMMENT ON COLUMN public.isp_service_catalog.monthly_price IS
  'Monthly subscription (abono). NULL until an administrator sets it. Never copied into OT amount_to_collect.';
COMMENT ON COLUMN public.isp_service_catalog.billing_method IS
  'Monthly collection channel placeholder. SIRO integration is out of scope.';
COMMENT ON COLUMN public.isp_service_catalog.is_seed IS
  'Initial skeleton rows. Prices are intentionally NULL.';

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
    IF v_type NOT IN ('pppoe', 'static_ip', 'dhcp', 'other') THEN
      RAISE EXCEPTION 'Tipo de conexión de catálogo inválido.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_service_catalog_validate_connection_types
  BEFORE INSERT OR UPDATE ON public.isp_service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_catalog_allowed_connection_types();

CREATE TRIGGER isp_service_catalog_set_updated_at
  BEFORE UPDATE ON public.isp_service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS catalog_id uuid
    REFERENCES public.isp_service_catalog (id) ON DELETE RESTRICT;

ALTER TABLE public.isp_services
  ALTER COLUMN technology DROP NOT NULL;

ALTER TABLE public.isp_services
  DROP CONSTRAINT IF EXISTS isp_services_technology_check;

ALTER TABLE public.isp_services
  ADD CONSTRAINT isp_services_technology_check
  CHECK (technology IS NULL OR technology IN ('ftth', 'wireless', 'other'));

CREATE INDEX IF NOT EXISTS isp_services_catalog_idx
  ON public.isp_services (company_id, catalog_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS service_catalog_id uuid
    REFERENCES public.isp_service_catalog (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS tasks_service_catalog_idx
  ON public.tasks (company_id, service_catalog_id)
  WHERE deleted_at IS NULL AND service_catalog_id IS NOT NULL;

COMMENT ON COLUMN public.isp_services.catalog_id IS
  'Catalog product that originated this contracted service. monthly_fee remains a snapshot.';
COMMENT ON COLUMN public.tasks.service_catalog_id IS
  'Catalog plan selected on the work order. NULL on historical OTs.';

CREATE OR REPLACE FUNCTION public.enforce_isp_service_catalog_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_catalog_company uuid;
BEGIN
  IF NEW.catalog_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id
    INTO v_catalog_company
  FROM public.isp_service_catalog
  WHERE id = NEW.catalog_id
    AND deleted_at IS NULL;

  IF v_catalog_company IS NULL THEN
    RAISE EXCEPTION 'El servicio contratado requiere un ítem de catálogo existente.';
  END IF;

  IF v_catalog_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El servicio contratado no puede usar un catálogo de otra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_services_enforce_catalog_company
  BEFORE INSERT OR UPDATE ON public.isp_services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_service_catalog_company_match();

CREATE OR REPLACE FUNCTION public.enforce_task_service_catalog_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_catalog_company uuid;
BEGIN
  IF NEW.service_catalog_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id
    INTO v_catalog_company
  FROM public.isp_service_catalog
  WHERE id = NEW.service_catalog_id
    AND deleted_at IS NULL;

  IF v_catalog_company IS NULL THEN
    RAISE EXCEPTION 'La OT requiere un ítem de catálogo existente.';
  END IF;

  IF v_catalog_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La OT no puede asociarse a un catálogo de otra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_enforce_service_catalog_company
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_service_catalog_company_match();

ALTER TABLE public.isp_service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_service_catalog_select_policy
  ON public.isp_service_catalog
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('clientes_360')
      OR public.auth_user_has_allowed_module('work_orders')
    )
  );

CREATE POLICY isp_service_catalog_insert_policy
  ON public.isp_service_catalog
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_service_catalog_update_policy
  ON public.isp_service_catalog
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

GRANT SELECT, INSERT, UPDATE ON public.isp_service_catalog TO authenticated;

INSERT INTO public.isp_service_catalog (
  company_id,
  name,
  category,
  customer_type,
  technology,
  download_speed_mbps,
  upload_speed_mbps,
  monthly_price,
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
  'internet',
  'residential',
  seed.technology,
  seed.download_speed_mbps,
  NULL,
  NULL,
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
      'ftth',
      50,
      '50 Mb',
      '50Mb',
      ARRAY['pppoe', 'static_ip']::text[]
    ),
    (
      'FTTH 100 Mb',
      'ftth',
      100,
      '100 Mb',
      '100Mb',
      ARRAY['pppoe', 'static_ip']::text[]
    ),
    (
      'FTTH 300 Mb',
      'ftth',
      300,
      '300 Mb',
      '300Mb',
      ARRAY['pppoe', 'static_ip']::text[]
    ),
    (
      'Wireless 20 Mb',
      'wireless',
      20,
      '20 Mb Wireless',
      '20Mb',
      ARRAY['static_ip']::text[]
    )
) AS seed(
  name,
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
    AND existing.legacy_plan_code = seed.legacy_plan_code
    AND existing.deleted_at IS NULL
);

CREATE OR REPLACE FUNCTION public.create_isp_onboarding(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_reuse boolean := COALESCE((p_payload ->> 'reuseExistingCustomer')::boolean, false);
  v_include_service boolean := COALESCE((p_payload ->> 'includeService')::boolean, false);
  v_include_connection boolean := COALESCE((p_payload ->> 'includeConnection')::boolean, false);
  v_existing_id uuid := NULLIF(p_payload ->> 'existingCustomerId', '')::uuid;
  v_source_task uuid := NULLIF(p_payload ->> 'sourceTaskId', '')::uuid;
  v_customer jsonb := COALESCE(p_payload -> 'customer', '{}'::jsonb);
  v_service jsonb := COALESCE(p_payload -> 'service', '{}'::jsonb);
  v_connection jsonb := COALESCE(p_payload -> 'connection', '{}'::jsonb);
  v_dni text := NULLIF(btrim(COALESCE(v_customer ->> 'dni', '')), '');
  v_name text := btrim(COALESCE(v_customer ->> 'name', ''));
  v_match public.customers%ROWTYPE;
  v_customer_id uuid;
  v_service_id uuid;
  v_connection_id uuid;
  v_connection_type text;
  v_catalog_id uuid := NULLIF(btrim(COALESCE(v_service ->> 'catalogId', '')), '')::uuid;
  v_catalog public.isp_service_catalog%ROWTYPE;
  v_technology text;
  v_plan_name text;
  v_contracted_speed text;
  v_monthly_fee numeric;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_user_has_allowed_module('clientes_360') THEN
    RAISE EXCEPTION 'No tiene acceso a Clientes 360°.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'El entorno demo no permite altas ISP.';
  END IF;

  IF v_include_connection AND NOT v_include_service THEN
    RAISE EXCEPTION 'Una conexión no puede existir sin un servicio.';
  END IF;

  IF v_catalog_id IS NOT NULL THEN
    SELECT *
      INTO v_catalog
    FROM public.isp_service_catalog
    WHERE id = v_catalog_id
      AND company_id = v_company_id
      AND deleted_at IS NULL;

    IF v_catalog.id IS NULL THEN
      RAISE EXCEPTION 'El servicio del catálogo no pertenece a esta empresa.';
    END IF;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    SELECT * INTO v_match
    FROM public.customers
    WHERE id = v_existing_id
      AND company_id = v_company_id
      AND deleted_at IS NULL;

    IF v_match.id IS NULL THEN
      RAISE EXCEPTION 'Cliente existente no encontrado.';
    END IF;

    v_customer_id := v_match.id;
  ELSIF v_dni IS NOT NULL THEN
    SELECT * INTO v_match
    FROM public.customers
    WHERE company_id = v_company_id
      AND deleted_at IS NULL
      AND regexp_replace(COALESCE(dni, ''), '\D', '', 'g')
        = regexp_replace(v_dni, '\D', '', 'g')
      AND length(regexp_replace(v_dni, '\D', '', 'g')) BETWEEN 7 AND 11
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_match.id IS NOT NULL AND NOT v_reuse THEN
      RETURN jsonb_build_object(
        'requiresConfirmation', true,
        'reusedExistingCustomer', false,
        'existingCustomer', jsonb_build_object(
          'id', v_match.id,
          'name', v_match.name,
          'dni', v_match.dni,
          'phone', v_match.phone
        )
      );
    END IF;

    IF v_match.id IS NOT NULL AND v_reuse THEN
      v_customer_id := v_match.id;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    IF v_name = '' THEN
      RAISE EXCEPTION 'Indique el nombre o razón social del cliente.';
    END IF;

    INSERT INTO public.customers (
      company_id,
      customer_number,
      name,
      dni,
      phone,
      whatsapp,
      email,
      address,
      locality,
      status
    )
    VALUES (
      v_company_id,
      public.next_isp_customer_number(v_company_id),
      v_name,
      v_dni,
      NULLIF(btrim(COALESCE(v_customer ->> 'phone', '')), ''),
      NULLIF(btrim(COALESCE(v_customer ->> 'whatsapp', '')), ''),
      NULLIF(btrim(COALESCE(v_customer ->> 'email', '')), ''),
      NULLIF(btrim(COALESCE(v_customer ->> 'address', '')), ''),
      NULLIF(btrim(COALESCE(v_customer ->> 'locality', '')), ''),
      'activo'
    )
    RETURNING id INTO v_customer_id;
  END IF;

  IF v_include_service THEN
    v_technology := NULLIF(btrim(COALESCE(v_service ->> 'technology', '')), '');
    IF v_technology IS NULL AND v_catalog.technology IS NOT NULL THEN
      v_technology := v_catalog.technology;
    END IF;
    IF v_technology IS NULL AND v_catalog.id IS NULL THEN
      RAISE EXCEPTION 'Indique la tecnología del servicio.';
    END IF;

    v_plan_name := NULLIF(btrim(COALESCE(v_service ->> 'planName', '')), '');
    IF v_plan_name IS NULL AND v_catalog.name IS NOT NULL THEN
      v_plan_name := v_catalog.name;
    END IF;
    IF v_plan_name IS NULL THEN
      RAISE EXCEPTION 'Indique el plan del servicio.';
    END IF;

    v_contracted_speed := NULLIF(btrim(COALESCE(v_service ->> 'contractedSpeed', '')), '');
    IF v_contracted_speed IS NULL AND v_catalog.download_speed_mbps IS NOT NULL THEN
      v_contracted_speed := v_catalog.download_speed_mbps::text || ' Mb';
    END IF;

    v_monthly_fee := NULLIF(v_service ->> 'monthlyFee', '')::numeric;
    IF v_monthly_fee IS NULL AND v_catalog.monthly_price IS NOT NULL THEN
      v_monthly_fee := v_catalog.monthly_price;
    END IF;

    INSERT INTO public.isp_services (
      company_id,
      customer_id,
      catalog_id,
      technology,
      plan_name,
      contracted_speed,
      monthly_fee,
      activation_date,
      commercial_status,
      monthly_collection_method,
      source_task_id,
      notes
    )
    VALUES (
      v_company_id,
      v_customer_id,
      v_catalog_id,
      v_technology,
      v_plan_name,
      v_contracted_speed,
      v_monthly_fee,
      NULLIF(v_service ->> 'activationDate', '')::date,
      COALESCE(NULLIF(v_service ->> 'commercialStatus', ''), 'pending_activation'),
      CASE
        WHEN v_service ->> 'monthlyCollectionMethod' = 'siro' THEN 'siro'
        WHEN v_catalog.billing_method = 'siro' THEN 'siro'
        ELSE 'pending'
      END,
      v_source_task,
      NULLIF(btrim(COALESCE(v_customer ->> 'notes', '')), '')
    )
    RETURNING id INTO v_service_id;
  END IF;

  IF v_include_connection THEN
    IF v_catalog.id IS NOT NULL AND v_catalog.requires_connection = false THEN
      RAISE EXCEPTION 'Este servicio del catálogo no requiere conexión técnica.';
    END IF;

    v_connection_type := v_connection ->> 'connectionType';
    IF v_connection_type IS NULL OR v_connection_type = '' THEN
      RAISE EXCEPTION 'Indique el tipo de conexión.';
    END IF;
    IF v_catalog.id IS NOT NULL
      AND COALESCE(array_length(v_catalog.allowed_connection_types, 1), 0) > 0
      AND NOT (v_connection_type = ANY (v_catalog.allowed_connection_types)) THEN
      RAISE EXCEPTION 'El tipo de conexión no está permitido para este servicio.';
    END IF;
    IF v_connection_type = 'pppoe' AND NULLIF(btrim(COALESCE(v_connection ->> 'pppoeUsername', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Indique el usuario PPPoE.';
    END IF;
    IF v_connection_type = 'pppoe' AND NULLIF(btrim(COALESCE(v_connection ->> 'pppoePassword', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Indique la contraseña PPPoE.';
    END IF;
    IF v_connection_type = 'static_ip' AND NULLIF(btrim(COALESCE(v_connection ->> 'ipAddress', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Indique la dirección IP.';
    END IF;

    INSERT INTO public.isp_connections (
      company_id,
      service_id,
      connection_type,
      pppoe_username,
      pppoe_password,
      technical_profile,
      ip_address,
      prefix_length,
      gateway,
      vlan,
      core_name,
      technical_status,
      source_task_id
    )
    VALUES (
      v_company_id,
      v_service_id,
      v_connection_type,
      NULLIF(btrim(COALESCE(v_connection ->> 'pppoeUsername', '')), ''),
      NULLIF(btrim(COALESCE(v_connection ->> 'pppoePassword', '')), ''),
      NULLIF(btrim(COALESCE(v_connection ->> 'technicalProfile', '')), ''),
      NULLIF(btrim(COALESCE(v_connection ->> 'ipAddress', '')), ''),
      NULLIF(v_connection ->> 'prefixLength', '')::integer,
      NULLIF(btrim(COALESCE(v_connection ->> 'gateway', '')), ''),
      NULLIF(btrim(COALESCE(v_connection ->> 'vlan', '')), ''),
      NULLIF(btrim(COALESCE(v_connection ->> 'coreName', '')), ''),
      COALESCE(NULLIF(v_connection ->> 'technicalStatus', ''), 'pending_provision'),
      v_source_task
    )
    RETURNING id INTO v_connection_id;
  END IF;

  RETURN jsonb_build_object(
    'customerId', v_customer_id,
    'serviceId', v_service_id,
    'connectionId', v_connection_id,
    'reusedExistingCustomer', COALESCE(v_reuse AND v_existing_id IS NOT NULL, false)
      OR (v_reuse AND v_match.id IS NOT NULL),
    'requiresConfirmation', false
  );
END;
$$;

COMMENT ON FUNCTION public.create_isp_onboarding(jsonb) IS
  'Transactional ISP onboarding with optional catalog snapshot. OT amount is never used as monthly fee.';
