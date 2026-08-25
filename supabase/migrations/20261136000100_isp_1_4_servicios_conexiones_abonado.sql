-- ISP 1.4 — Contracted services and connections from Clientes 360°.
-- Additive. Does not rewrite OT, migración, Tesorería or the commercial catalog.
-- Does not provision MikroTik. Technical status on create is always pending_provision.

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS catalog_code text;

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS download_speed integer
    CHECK (download_speed IS NULL OR download_speed >= 0);

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS upload_speed integer
    CHECK (upload_speed IS NULL OR upload_speed >= 0);

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS speed_unit text NOT NULL DEFAULT 'mbps';

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS list_price numeric(12, 2)
    CHECK (list_price IS NULL OR list_price >= 0);

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS replaced_service_id uuid
    REFERENCES public.isp_services (id) ON DELETE SET NULL;

ALTER TABLE public.isp_connections
  ADD COLUMN IF NOT EXISTS technical_profile_id uuid
    REFERENCES public.isp_technical_profiles (id) ON DELETE SET NULL;

ALTER TABLE public.isp_connections
  ADD COLUMN IF NOT EXISTS core_profile_id text;

COMMENT ON COLUMN public.isp_services.catalog_code IS
  'Commercial catalog code snapshot at contract time.';
COMMENT ON COLUMN public.isp_services.download_speed IS
  'Contracted download snapshot. Independent from upload_speed.';
COMMENT ON COLUMN public.isp_services.upload_speed IS
  'Contracted upload snapshot. Independent from download_speed.';
COMMENT ON COLUMN public.isp_services.list_price IS
  'Catalog list price at contract time. monthly_fee is the contracted price.';
COMMENT ON COLUMN public.isp_services.replaced_service_id IS
  'Previous contracted service kept as history when the plan changes.';
COMMENT ON COLUMN public.isp_connections.technical_profile_id IS
  'Technical profile reference. Speeds live on the contracted service, not here.';
COMMENT ON COLUMN public.isp_connections.core_profile_id IS
  'Configured Core profile identifier. Placeholder until ISP 1.6.';

CREATE INDEX IF NOT EXISTS isp_services_replaced_idx
  ON public.isp_services (company_id, replaced_service_id)
  WHERE deleted_at IS NULL AND replaced_service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS isp_connections_technical_profile_idx
  ON public.isp_connections (company_id, technical_profile_id)
  WHERE deleted_at IS NULL AND technical_profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_isp_connection_technical_profile_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile_company uuid;
  v_profile_type text;
BEGIN
  IF NEW.technical_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id, connection_type
    INTO v_profile_company, v_profile_type
  FROM public.isp_technical_profiles
  WHERE id = NEW.technical_profile_id
    AND deleted_at IS NULL;

  IF v_profile_company IS NULL THEN
    RAISE EXCEPTION 'La conexión requiere un perfil técnico existente.';
  END IF;

  IF v_profile_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La conexión no puede usar un perfil técnico de otra empresa.';
  END IF;

  IF v_profile_type IS NOT NULL AND v_profile_type IS DISTINCT FROM NEW.connection_type THEN
    RAISE EXCEPTION 'El perfil técnico no es válido para este tipo de conexión.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS isp_connections_enforce_technical_profile_company
  ON public.isp_connections;

CREATE TRIGGER isp_connections_enforce_technical_profile_company
  BEFORE INSERT OR UPDATE ON public.isp_connections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_connection_technical_profile_company();

CREATE OR REPLACE FUNCTION public.isp_create_connection_on_service(
  p_service_id uuid,
  p_connection jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_service public.isp_services%ROWTYPE;
  v_catalog public.isp_service_catalog%ROWTYPE;
  v_connection jsonb := COALESCE(p_connection, '{}'::jsonb);
  v_connection_type text;
  v_profile_id uuid;
  v_profile_code text;
  v_profile_core_name text;
  v_profile_core_id text;
  v_profile_type text;
  v_profile_active boolean;
  v_profile_company uuid;
  v_connection_id uuid;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF p_service_id IS NULL THEN
    RAISE EXCEPTION 'Una conexión no puede existir sin un servicio.';
  END IF;

  SELECT * INTO v_service
  FROM public.isp_services
  WHERE id = p_service_id
    AND company_id = v_company_id
    AND deleted_at IS NULL;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'El servicio contratado no pertenece a esta empresa.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.isp_connections
    WHERE service_id = v_service.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Este servicio ya tiene una conexión técnica.';
  END IF;

  IF v_service.catalog_id IS NOT NULL THEN
    SELECT * INTO v_catalog
    FROM public.isp_service_catalog
    WHERE id = v_service.catalog_id
      AND deleted_at IS NULL;

    IF v_catalog.id IS NULL THEN
      RAISE EXCEPTION 'El servicio del catálogo no pertenece a esta empresa.';
    END IF;

    IF v_catalog.company_id IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'El servicio del catálogo no pertenece a esta empresa.';
    END IF;
  END IF;

  v_connection_type := NULLIF(btrim(COALESCE(v_connection ->> 'connectionType', '')), '');
  IF v_connection_type IS NULL THEN
    RAISE EXCEPTION 'Indique el tipo de conexión.';
  END IF;
  IF v_connection_type NOT IN ('pppoe', 'static_ip', 'dhcp', 'other') THEN
    RAISE EXCEPTION 'Tipo de conexión inválido.';
  END IF;

  IF v_catalog.id IS NOT NULL
    AND COALESCE(array_length(v_catalog.allowed_connection_types, 1), 0) > 0
    AND NOT (v_connection_type = ANY (v_catalog.allowed_connection_types)) THEN
    RAISE EXCEPTION 'El tipo de conexión no está permitido para este servicio.';
  END IF;

  IF v_connection_type = 'pppoe'
    AND NULLIF(btrim(COALESCE(v_connection ->> 'pppoeUsername', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Indique el usuario PPPoE.';
  END IF;
  IF v_connection_type = 'pppoe'
    AND NULLIF(btrim(COALESCE(v_connection ->> 'pppoePassword', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Indique la contraseña PPPoE.';
  END IF;
  IF v_connection_type = 'static_ip'
    AND NULLIF(btrim(COALESCE(v_connection ->> 'ipAddress', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Indique la dirección IP.';
  END IF;

  v_profile_id := NULLIF(v_connection ->> 'technicalProfileId', '')::uuid;
  IF v_profile_id IS NULL AND v_catalog.technical_profile_id IS NOT NULL THEN
    v_profile_id := v_catalog.technical_profile_id;
  END IF;

  IF v_profile_id IS NOT NULL THEN
    SELECT
      company_id,
      code,
      core_name,
      core_profile_id,
      connection_type,
      is_active
      INTO
        v_profile_company,
        v_profile_code,
        v_profile_core_name,
        v_profile_core_id,
        v_profile_type,
        v_profile_active
    FROM public.isp_technical_profiles
    WHERE id = v_profile_id
      AND deleted_at IS NULL;

    IF v_profile_company IS NULL THEN
      RAISE EXCEPTION 'El perfil técnico no pertenece a esta empresa.';
    END IF;
    IF v_profile_company IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'El perfil técnico no pertenece a esta empresa.';
    END IF;
    IF v_profile_active IS NOT TRUE THEN
      RAISE EXCEPTION 'El perfil técnico no está activo.';
    END IF;
    IF v_profile_type IS NOT NULL AND v_profile_type IS DISTINCT FROM v_connection_type THEN
      RAISE EXCEPTION 'El perfil técnico no es válido para este tipo de conexión.';
    END IF;
  END IF;

  INSERT INTO public.isp_connections (
    company_id,
    service_id,
    connection_type,
    pppoe_username,
    pppoe_password,
    technical_profile,
    technical_profile_id,
    ip_address,
    prefix_length,
    gateway,
    vlan,
    core_name,
    core_profile_id,
    technical_status
  )
  VALUES (
    v_company_id,
    v_service.id,
    v_connection_type,
    CASE WHEN v_connection_type = 'pppoe'
      THEN NULLIF(btrim(COALESCE(v_connection ->> 'pppoeUsername', '')), '')
      ELSE NULL
    END,
    CASE WHEN v_connection_type = 'pppoe'
      THEN NULLIF(btrim(COALESCE(v_connection ->> 'pppoePassword', '')), '')
      ELSE NULL
    END,
    COALESCE(
      NULLIF(btrim(COALESCE(v_connection ->> 'technicalProfile', '')), ''),
      v_profile_code,
      v_profile_core_id
    ),
    v_profile_id,
    CASE WHEN v_connection_type = 'static_ip'
      THEN NULLIF(btrim(COALESCE(v_connection ->> 'ipAddress', '')), '')
      ELSE NULL
    END,
    CASE WHEN v_connection_type = 'static_ip'
      THEN NULLIF(v_connection ->> 'prefixLength', '')::integer
      ELSE NULL
    END,
    CASE WHEN v_connection_type = 'static_ip'
      THEN NULLIF(btrim(COALESCE(v_connection ->> 'gateway', '')), '')
      ELSE NULL
    END,
    NULLIF(btrim(COALESCE(v_connection ->> 'vlan', '')), ''),
    COALESCE(
      NULLIF(btrim(COALESCE(v_connection ->> 'coreName', '')), ''),
      v_profile_core_name,
      'MikroTik'
    ),
    COALESCE(
      NULLIF(btrim(COALESCE(v_connection ->> 'coreProfileId', '')), ''),
      v_profile_core_id
    ),
    'pending_provision'
  )
  RETURNING id INTO v_connection_id;

  RETURN v_connection_id;
END;
$$;

COMMENT ON FUNCTION public.isp_create_connection_on_service(uuid, jsonb) IS
  'Creates a technical connection for an existing contracted service. Never creates an orphan connection.';

CREATE OR REPLACE FUNCTION public.create_isp_subscriber_service(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_customer_id uuid := NULLIF(p_payload ->> 'customerId', '')::uuid;
  v_catalog_id uuid := NULLIF(p_payload ->> 'catalogId', '')::uuid;
  v_include_connection boolean := COALESCE((p_payload ->> 'includeConnection')::boolean, false);
  v_replaced_id uuid := NULLIF(p_payload ->> 'replacedServiceId', '')::uuid;
  v_catalog public.isp_service_catalog%ROWTYPE;
  v_connection jsonb := COALESCE(p_payload -> 'connection', '{}'::jsonb);
  v_service_id uuid;
  v_connection_id uuid;
  v_monthly_fee numeric;
  v_list_price numeric;
  v_activation date;
  v_status text;
  v_download integer;
  v_upload integer;
  v_speed_unit text;
  v_contracted_speed text;
  v_technology text;
  v_subscriber uuid;
  v_speed_label text;
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

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Indique el abonado.';
  END IF;

  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'Indique el servicio del catálogo.';
  END IF;

  SELECT id INTO v_subscriber
  FROM public.isp_subscribers
  WHERE company_id = v_company_id
    AND customer_id = v_customer_id
    AND deleted_at IS NULL;

  IF v_subscriber IS NULL THEN
    RAISE EXCEPTION 'Abonado no encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = v_customer_id
      AND company_id = v_company_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'El abonado no pertenece a esta empresa.';
  END IF;

  SELECT * INTO v_catalog
  FROM public.isp_service_catalog
  WHERE id = v_catalog_id
    AND company_id = v_company_id
    AND deleted_at IS NULL;

  IF v_catalog.id IS NULL THEN
    RAISE EXCEPTION 'El servicio del catálogo no pertenece a esta empresa.';
  END IF;

  IF v_catalog.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'El servicio del catálogo no está activo.';
  END IF;

  IF v_replaced_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.isp_services
      WHERE id = v_replaced_id
        AND company_id = v_company_id
        AND customer_id = v_customer_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'El servicio a reemplazar no pertenece a este abonado.';
    END IF;

    UPDATE public.isp_services
    SET commercial_status = 'cancelled'
    WHERE id = v_replaced_id
      AND company_id = v_company_id
      AND deleted_at IS NULL;
  END IF;

  v_list_price := v_catalog.monthly_price;
  v_monthly_fee := NULLIF(p_payload ->> 'monthlyFee', '')::numeric;
  IF v_monthly_fee IS NULL THEN
    v_monthly_fee := v_list_price;
  END IF;
  IF v_monthly_fee IS NOT NULL AND v_monthly_fee < 0 THEN
    RAISE EXCEPTION 'El precio contratado no puede ser negativo.';
  END IF;

  v_activation := COALESCE(NULLIF(p_payload ->> 'activationDate', '')::date, CURRENT_DATE);
  v_status := COALESCE(NULLIF(p_payload ->> 'commercialStatus', ''), 'pending_activation');
  IF v_status NOT IN ('pending_activation', 'active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Estado comercial inválido.';
  END IF;

  v_download := v_catalog.download_speed_mbps;
  v_upload := v_catalog.upload_speed_mbps;
  v_speed_unit := COALESCE(NULLIF(v_catalog.speed_unit, ''), 'mbps');
  v_speed_label := CASE WHEN lower(v_speed_unit) = 'mbps' THEN 'Mbps' ELSE v_speed_unit END;
  IF v_download IS NOT NULL AND v_upload IS NOT NULL THEN
    v_contracted_speed := v_download::text || '/' || v_upload::text || ' ' || v_speed_label;
  ELSIF v_download IS NOT NULL THEN
    v_contracted_speed := v_download::text || '/— ' || v_speed_label;
  ELSE
    v_contracted_speed := NULL;
  END IF;

  v_technology := v_catalog.technology;
  IF v_technology IS NOT NULL AND v_technology NOT IN ('ftth', 'wireless', 'other') THEN
    v_technology := NULL;
  END IF;

  INSERT INTO public.isp_services (
    company_id,
    customer_id,
    catalog_id,
    catalog_code,
    technology,
    plan_name,
    contracted_speed,
    download_speed,
    upload_speed,
    speed_unit,
    list_price,
    monthly_fee,
    activation_date,
    commercial_status,
    monthly_collection_method,
    notes,
    replaced_service_id
  )
  VALUES (
    v_company_id,
    v_customer_id,
    v_catalog.id,
    v_catalog.code,
    v_technology,
    v_catalog.name,
    v_contracted_speed,
    v_download,
    v_upload,
    v_speed_unit,
    v_list_price,
    v_monthly_fee,
    v_activation,
    v_status,
    CASE WHEN v_catalog.billing_method = 'siro' THEN 'siro' ELSE 'pending' END,
    NULLIF(btrim(COALESCE(p_payload ->> 'notes', '')), ''),
    v_replaced_id
  )
  RETURNING id INTO v_service_id;

  IF v_include_connection THEN
    v_connection_id := public.isp_create_connection_on_service(v_service_id, v_connection);
  END IF;

  RETURN jsonb_build_object(
    'customerId', v_customer_id,
    'serviceId', v_service_id,
    'connectionId', v_connection_id,
    'replacedServiceId', v_replaced_id
  );
END;
$$;

COMMENT ON FUNCTION public.create_isp_subscriber_service(jsonb) IS
  'Transactional contracted-service create for an existing ISP subscriber. Optional connection; rolls back as one unit.';

CREATE OR REPLACE FUNCTION public.create_isp_service_connection(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_service_id uuid := NULLIF(p_payload ->> 'serviceId', '')::uuid;
  v_connection_id uuid;
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

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION 'Una conexión no puede existir sin un servicio.';
  END IF;

  v_connection_id := public.isp_create_connection_on_service(
    v_service_id,
    COALESCE(p_payload -> 'connection', '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'serviceId', v_service_id,
    'connectionId', v_connection_id
  );
END;
$$;

COMMENT ON FUNCTION public.create_isp_service_connection(jsonb) IS
  'Adds a technical connection to an existing contracted service. Rejects orphans.';

CREATE OR REPLACE FUNCTION public.update_isp_contracted_service(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_service_id uuid := NULLIF(p_payload ->> 'serviceId', '')::uuid;
  v_monthly_fee numeric;
  v_activation date;
  v_status text;
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

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION 'Indique el servicio contratado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.isp_services
    WHERE id = v_service_id
      AND company_id = v_company_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'El servicio contratado no pertenece a esta empresa.';
  END IF;

  v_monthly_fee := NULLIF(p_payload ->> 'monthlyFee', '')::numeric;
  IF v_monthly_fee IS NOT NULL AND v_monthly_fee < 0 THEN
    RAISE EXCEPTION 'El precio contratado no puede ser negativo.';
  END IF;

  v_activation := NULLIF(p_payload ->> 'activationDate', '')::date;
  v_status := NULLIF(p_payload ->> 'commercialStatus', '');
  IF v_status IS NOT NULL
    AND v_status NOT IN ('pending_activation', 'active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Estado comercial inválido.';
  END IF;

  UPDATE public.isp_services
  SET
    monthly_fee = COALESCE(v_monthly_fee, monthly_fee),
    activation_date = COALESCE(v_activation, activation_date),
    commercial_status = COALESCE(v_status, commercial_status),
    notes = CASE
      WHEN p_payload ? 'notes' THEN NULLIF(btrim(COALESCE(p_payload ->> 'notes', '')), '')
      ELSE notes
    END
  WHERE id = v_service_id
    AND company_id = v_company_id
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('serviceId', v_service_id);
END;
$$;

COMMENT ON FUNCTION public.update_isp_contracted_service(jsonb) IS
  'Updates contracted price, activation date, commercial status and notes. Does not modify the catalog.';

CREATE OR REPLACE FUNCTION public.update_isp_connection(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_connection_id uuid := NULLIF(p_payload ->> 'connectionId', '')::uuid;
  v_connection jsonb := COALESCE(p_payload -> 'connection', '{}'::jsonb);
  v_row public.isp_connections%ROWTYPE;
  v_service public.isp_services%ROWTYPE;
  v_catalog public.isp_service_catalog%ROWTYPE;
  v_connection_type text;
  v_profile_id uuid;
  v_profile_code text;
  v_profile_core_name text;
  v_profile_core_id text;
  v_profile_type text;
  v_profile_active boolean;
  v_profile_company uuid;
  v_technical_status text;
  v_password text;
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

  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'Indique la conexión.';
  END IF;

  SELECT * INTO v_row
  FROM public.isp_connections
  WHERE id = v_connection_id
    AND company_id = v_company_id
    AND deleted_at IS NULL;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'La conexión no pertenece a esta empresa.';
  END IF;

  SELECT * INTO v_service
  FROM public.isp_services
  WHERE id = v_row.service_id
    AND company_id = v_company_id
    AND deleted_at IS NULL;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'Una conexión no puede existir sin un servicio.';
  END IF;

  IF v_service.catalog_id IS NOT NULL THEN
    SELECT * INTO v_catalog
    FROM public.isp_service_catalog
    WHERE id = v_service.catalog_id
      AND company_id = v_company_id
      AND deleted_at IS NULL;
  END IF;

  v_connection_type := COALESCE(
    NULLIF(btrim(COALESCE(v_connection ->> 'connectionType', '')), ''),
    v_row.connection_type
  );
  IF v_connection_type NOT IN ('pppoe', 'static_ip', 'dhcp', 'other') THEN
    RAISE EXCEPTION 'Tipo de conexión inválido.';
  END IF;

  IF v_catalog.id IS NOT NULL
    AND COALESCE(array_length(v_catalog.allowed_connection_types, 1), 0) > 0
    AND NOT (v_connection_type = ANY (v_catalog.allowed_connection_types)) THEN
    RAISE EXCEPTION 'El tipo de conexión no está permitido para este servicio.';
  END IF;

  IF v_connection_type = 'pppoe'
    AND NULLIF(btrim(COALESCE(
      COALESCE(v_connection ->> 'pppoeUsername', v_row.pppoe_username),
      ''
    )), '') IS NULL THEN
    RAISE EXCEPTION 'Indique el usuario PPPoE.';
  END IF;

  IF v_connection_type = 'pppoe' THEN
    v_password := NULLIF(btrim(COALESCE(v_connection ->> 'pppoePassword', '')), '');
    IF v_password IS NULL THEN
      v_password := v_row.pppoe_password;
    END IF;
    IF v_password IS NULL THEN
      RAISE EXCEPTION 'Indique la contraseña PPPoE.';
    END IF;
  END IF;

  IF v_connection_type = 'static_ip'
    AND NULLIF(btrim(COALESCE(
      COALESCE(v_connection ->> 'ipAddress', v_row.ip_address),
      ''
    )), '') IS NULL THEN
    RAISE EXCEPTION 'Indique la dirección IP.';
  END IF;

  v_profile_id := COALESCE(
    NULLIF(v_connection ->> 'technicalProfileId', '')::uuid,
    v_row.technical_profile_id
  );

  IF v_profile_id IS NOT NULL THEN
    SELECT
      company_id,
      code,
      core_name,
      core_profile_id,
      connection_type,
      is_active
      INTO
        v_profile_company,
        v_profile_code,
        v_profile_core_name,
        v_profile_core_id,
        v_profile_type,
        v_profile_active
    FROM public.isp_technical_profiles
    WHERE id = v_profile_id
      AND deleted_at IS NULL;

    IF v_profile_company IS NULL OR v_profile_company IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'El perfil técnico no pertenece a esta empresa.';
    END IF;
    IF v_profile_active IS NOT TRUE AND v_profile_id IS DISTINCT FROM v_row.technical_profile_id THEN
      RAISE EXCEPTION 'El perfil técnico no está activo.';
    END IF;
    IF v_profile_type IS NOT NULL AND v_profile_type IS DISTINCT FROM v_connection_type THEN
      RAISE EXCEPTION 'El perfil técnico no es válido para este tipo de conexión.';
    END IF;
  END IF;

  v_technical_status := COALESCE(
    NULLIF(v_connection ->> 'technicalStatus', ''),
    v_row.technical_status
  );
  IF v_technical_status NOT IN (
    'pending_provision',
    'provisioned',
    'provision_error',
    'disconnected'
  ) THEN
    RAISE EXCEPTION 'Estado técnico inválido.';
  END IF;

  UPDATE public.isp_connections
  SET
    connection_type = v_connection_type,
    pppoe_username = CASE WHEN v_connection_type = 'pppoe'
      THEN NULLIF(btrim(COALESCE(v_connection ->> 'pppoeUsername', v_row.pppoe_username, '')), '')
      ELSE NULL
    END,
    pppoe_password = CASE WHEN v_connection_type = 'pppoe'
      THEN v_password
      ELSE NULL
    END,
    technical_profile = COALESCE(
      NULLIF(btrim(COALESCE(v_connection ->> 'technicalProfile', '')), ''),
      v_row.technical_profile,
      v_profile_code
    ),
    technical_profile_id = v_profile_id,
    ip_address = CASE WHEN v_connection_type = 'static_ip'
      THEN NULLIF(btrim(COALESCE(v_connection ->> 'ipAddress', v_row.ip_address, '')), '')
      ELSE NULL
    END,
    prefix_length = CASE WHEN v_connection_type = 'static_ip'
      THEN COALESCE(
        NULLIF(v_connection ->> 'prefixLength', '')::integer,
        v_row.prefix_length
      )
      ELSE NULL
    END,
    gateway = CASE WHEN v_connection_type = 'static_ip'
      THEN NULLIF(btrim(COALESCE(v_connection ->> 'gateway', v_row.gateway, '')), '')
      ELSE NULL
    END,
    vlan = COALESCE(
      NULLIF(btrim(COALESCE(v_connection ->> 'vlan', '')), ''),
      v_row.vlan
    ),
    core_name = COALESCE(
      NULLIF(btrim(COALESCE(v_connection ->> 'coreName', '')), ''),
      v_row.core_name,
      v_profile_core_name,
      'MikroTik'
    ),
    core_profile_id = COALESCE(
      NULLIF(btrim(COALESCE(v_connection ->> 'coreProfileId', '')), ''),
      v_row.core_profile_id,
      v_profile_core_id
    ),
    technical_status = v_technical_status
  WHERE id = v_connection_id
    AND company_id = v_company_id
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('connectionId', v_connection_id, 'serviceId', v_row.service_id);
END;
$$;

COMMENT ON FUNCTION public.update_isp_connection(jsonb) IS
  'Updates a technical connection without reparenting it to another service. Empty password keeps the stored secret.';

GRANT EXECUTE ON FUNCTION public.isp_create_connection_on_service(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_isp_subscriber_service(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_isp_service_connection(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_isp_contracted_service(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_isp_connection(jsonb) TO authenticated;
