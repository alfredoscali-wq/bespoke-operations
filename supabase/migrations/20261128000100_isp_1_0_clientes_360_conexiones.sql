-- ISP 1.0 — Clientes 360° + Servicios / Conexiones
-- Reuses public.customers. Adds isp_services + isp_connections.
-- Does not alter Clientes, OT, Atención al Cliente or Tesorería screens.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS whatsapp text;

COMMENT ON COLUMN public.customers.whatsapp IS
  'Optional WhatsApp number for ISP 360. Existing Clientes UI does not expose this field.';

CREATE TABLE public.isp_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  technology text NOT NULL
    CHECK (technology IN ('ftth', 'wireless')),
  plan_name text NOT NULL,
  contracted_speed text,
  monthly_fee numeric(12, 2) CHECK (monthly_fee IS NULL OR monthly_fee >= 0),
  activation_date date,
  commercial_status text NOT NULL DEFAULT 'pending_activation'
    CHECK (commercial_status IN (
      'pending_activation',
      'active',
      'suspended',
      'cancelled'
    )),
  monthly_collection_method text NOT NULL DEFAULT 'pending'
    CHECK (monthly_collection_method IN ('pending', 'siro')),
  source_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX isp_services_company_customer_idx
  ON public.isp_services (company_id, customer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX isp_services_company_status_idx
  ON public.isp_services (company_id, commercial_status)
  WHERE deleted_at IS NULL;

CREATE TABLE public.isp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  service_id uuid NOT NULL REFERENCES public.isp_services (id),
  connection_type text NOT NULL
    CHECK (connection_type IN ('pppoe', 'static_ip', 'dhcp', 'other')),
  pppoe_username text,
  pppoe_password text,
  technical_profile text,
  ip_address text,
  prefix_length integer CHECK (prefix_length IS NULL OR (prefix_length >= 0 AND prefix_length <= 128)),
  gateway text,
  vlan text,
  core_name text,
  technical_status text NOT NULL DEFAULT 'pending_provision'
    CHECK (technical_status IN (
      'pending_provision',
      'provisioned',
      'provision_error',
      'disconnected'
    )),
  last_sync_at timestamptz,
  provision_error text,
  source_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT isp_connections_service_unique UNIQUE (service_id)
);

CREATE INDEX isp_connections_company_idx
  ON public.isp_connections (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX isp_connections_company_type_idx
  ON public.isp_connections (company_id, connection_type)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_isp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_services_set_updated_at
  BEFORE UPDATE ON public.isp_services
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_connections_set_updated_at
  BEFORE UPDATE ON public.isp_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_isp_service_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_company uuid;
BEGIN
  SELECT company_id
    INTO v_customer_company
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_customer_company IS NULL THEN
    RAISE EXCEPTION 'El servicio requiere un cliente existente.';
  END IF;

  IF v_customer_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El servicio no puede asociarse a un cliente de otra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_services_enforce_company
  BEFORE INSERT OR UPDATE ON public.isp_services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_service_company_match();

CREATE OR REPLACE FUNCTION public.enforce_isp_connection_service_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_service public.isp_services%ROWTYPE;
BEGIN
  SELECT *
    INTO v_service
  FROM public.isp_services
  WHERE id = NEW.service_id
    AND deleted_at IS NULL;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'La conexión requiere un servicio existente.';
  END IF;

  IF v_service.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La conexión no puede asociarse a un servicio de otra empresa.';
  END IF;

  NEW.company_id := v_service.company_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_connections_enforce_service
  BEFORE INSERT OR UPDATE ON public.isp_connections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_connection_service_match();

ALTER TABLE public.isp_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_services_select_policy
  ON public.isp_services
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
  );

CREATE POLICY isp_services_insert_policy
  ON public.isp_services
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_services_update_policy
  ON public.isp_services
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

CREATE POLICY isp_connections_select_policy
  ON public.isp_connections
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
  );

CREATE POLICY isp_connections_insert_policy
  ON public.isp_connections
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_connections_update_policy
  ON public.isp_connections
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

CREATE OR REPLACE FUNCTION public.next_isp_customer_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_latest text;
  v_counter integer := 0;
BEGIN
  SELECT customer_number
    INTO v_latest
  FROM public.customers
  WHERE company_id = p_company_id
    AND customer_number ~ '^CLI-[0-9]+$'
  ORDER BY customer_number DESC
  LIMIT 1;

  IF v_latest IS NOT NULL THEN
    v_counter := substring(v_latest from 5)::integer;
  END IF;

  RETURN 'CLI-' || lpad((v_counter + 1)::text, 6, '0');
END;
$$;

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
    IF NULLIF(btrim(COALESCE(v_service ->> 'technology', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Indique la tecnología del servicio.';
    END IF;
    IF NULLIF(btrim(COALESCE(v_service ->> 'planName', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Indique el plan del servicio.';
    END IF;

    INSERT INTO public.isp_services (
      company_id,
      customer_id,
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
      v_service ->> 'technology',
      btrim(v_service ->> 'planName'),
      NULLIF(btrim(COALESCE(v_service ->> 'contractedSpeed', '')), ''),
      NULLIF(v_service ->> 'monthlyFee', '')::numeric,
      NULLIF(v_service ->> 'activationDate', '')::date,
      COALESCE(NULLIF(v_service ->> 'commercialStatus', ''), 'pending_activation'),
      CASE
        WHEN v_service ->> 'monthlyCollectionMethod' = 'siro' THEN 'siro'
        ELSE 'pending'
      END,
      v_source_task,
      NULLIF(btrim(COALESCE(v_customer ->> 'notes', '')), '')
    )
    RETURNING id INTO v_service_id;
  END IF;

  IF v_include_connection THEN
    v_connection_type := v_connection ->> 'connectionType';
    IF v_connection_type IS NULL OR v_connection_type = '' THEN
      RAISE EXCEPTION 'Indique el tipo de conexión.';
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

GRANT SELECT, INSERT, UPDATE ON public.isp_services TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.isp_connections TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_isp_customer_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_isp_onboarding(jsonb) TO authenticated;

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"clientes_360": true}'::jsonb
WHERE code IN (
  'administrador',
  'administracion',
  'atencion_cliente',
  'ventas',
  'tecnica',
  'supervisor'
);

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"clientes_360": false}'::jsonb
WHERE code IN ('rrhh', 'operario');

COMMENT ON TABLE public.isp_services IS
  'ISP commercial service belonging to a single customer. Monthly collection is independent from OT payment method.';
COMMENT ON TABLE public.isp_connections IS
  'Technical connection for an ISP service. Requires a service; MikroTik provisioning is out of scope.';
COMMENT ON FUNCTION public.create_isp_onboarding(jsonb) IS
  'Transactional ISP onboarding: customer (optional reuse by DNI) + optional service + optional connection.';
