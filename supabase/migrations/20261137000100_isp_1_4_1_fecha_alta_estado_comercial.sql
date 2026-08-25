-- ISP 1.4.1 — Activation date drives initial commercial status.
-- Additive. Does not rewrite 1.4, OT, Tesorería, billing or MikroTik.
-- Empty connection fields keep stored values. Subsequent Suspendido/Baja stay explicit.

COMMENT ON COLUMN public.isp_services.activation_date IS
  'Effective commercial start. Future billing uses this date as the start of commercial validity; mid-period altas will require proration. No invoices are generated in this sprint.';

CREATE OR REPLACE FUNCTION public.isp_keep_text(p_incoming text, p_existing text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(btrim(COALESCE(p_incoming, '')), ''), p_existing);
$$;

COMMENT ON FUNCTION public.isp_keep_text(text, text) IS
  'Empty or missing incoming text keeps the stored value.';

CREATE OR REPLACE FUNCTION public.isp_commercial_status_from_activation(p_activation date)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_activation IS NULL THEN 'pending_activation'
    WHEN p_activation <= CURRENT_DATE THEN 'active'
    ELSE 'pending_activation'
  END;
$$;

COMMENT ON FUNCTION public.isp_commercial_status_from_activation(date) IS
  'Date-driven commercial status for the initial alta. Suspended and cancelled are subsequent events.';

CREATE OR REPLACE FUNCTION public.isp_apply_activation_commercial_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.commercial_status IN ('suspended', 'cancelled') THEN
      RETURN NEW;
    END IF;
    NEW.commercial_status := public.isp_commercial_status_from_activation(NEW.activation_date);
    RETURN NEW;
  END IF;

  IF NEW.commercial_status IN ('suspended', 'cancelled') THEN
    RETURN NEW;
  END IF;

  NEW.commercial_status := public.isp_commercial_status_from_activation(NEW.activation_date);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS isp_services_apply_activation_commercial_status ON public.isp_services;
CREATE TRIGGER isp_services_apply_activation_commercial_status
  BEFORE INSERT OR UPDATE OF activation_date, commercial_status
  ON public.isp_services
  FOR EACH ROW
  EXECUTE FUNCTION public.isp_apply_activation_commercial_status();

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
    public.isp_keep_text(v_connection ->> 'connectionType', v_row.connection_type),
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
    AND public.isp_keep_text(v_connection ->> 'pppoeUsername', v_row.pppoe_username) IS NULL THEN
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
    AND public.isp_keep_text(v_connection ->> 'ipAddress', v_row.ip_address) IS NULL THEN
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
      THEN public.isp_keep_text(v_connection ->> 'pppoeUsername', v_row.pppoe_username)
      ELSE NULL
    END,
    pppoe_password = CASE WHEN v_connection_type = 'pppoe'
      THEN v_password
      ELSE NULL
    END,
    technical_profile = COALESCE(
      public.isp_keep_text(v_connection ->> 'technicalProfile', v_row.technical_profile),
      v_profile_code
    ),
    technical_profile_id = v_profile_id,
    ip_address = CASE WHEN v_connection_type = 'static_ip'
      THEN public.isp_keep_text(v_connection ->> 'ipAddress', v_row.ip_address)
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
      THEN public.isp_keep_text(v_connection ->> 'gateway', v_row.gateway)
      ELSE NULL
    END,
    vlan = public.isp_keep_text(v_connection ->> 'vlan', v_row.vlan),
    core_name = COALESCE(
      public.isp_keep_text(v_connection ->> 'coreName', v_row.core_name),
      v_profile_core_name,
      'MikroTik'
    ),
    core_profile_id = COALESCE(
      public.isp_keep_text(v_connection ->> 'coreProfileId', v_row.core_profile_id),
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
  'Updates a technical connection without reparenting. Empty text keeps stored values. Empty password keeps the stored secret. Speeds stay on the contracted service.';

GRANT EXECUTE ON FUNCTION public.update_isp_connection(jsonb) TO authenticated;
