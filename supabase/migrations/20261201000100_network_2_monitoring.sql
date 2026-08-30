-- Network 2.0 — Monitoring 1.0: operational status separate from discovery inventory.
-- Does not alter network_devices / network_interfaces inventory columns used by Discovery.
-- Does not alter isp_connections.

CREATE TABLE public.network_device_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  device_id uuid NOT NULL REFERENCES public.network_devices (id),
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'online', 'offline', 'degraded')),
  last_poll_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0
    CHECK (consecutive_failures >= 0),
  uptime text,
  cpu_load double precision,
  memory_total bigint,
  memory_available bigint,
  routeros_version text,
  temperature double precision,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX network_device_status_device_idx
  ON public.network_device_status (device_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_device_status_company_idx
  ON public.network_device_status (company_id, status)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_device_status IS
  'Current operational status and last poll metrics. Not a time-series store. Inventory remains in network_devices.';

CREATE TABLE public.network_interface_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  device_id uuid NOT NULL REFERENCES public.network_devices (id),
  interface_id uuid NOT NULL REFERENCES public.network_interfaces (id),
  interface_name text NOT NULL,
  status text,
  speed_mbps integer,
  rx_bytes bigint,
  tx_bytes bigint,
  rx_packets bigint,
  tx_packets bigint,
  rx_errors bigint,
  tx_errors bigint,
  rx_drops bigint,
  tx_drops bigint,
  last_poll_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_interface_status_name_not_blank
    CHECK (char_length(btrim(interface_name)) > 0)
);

CREATE UNIQUE INDEX network_interface_status_interface_idx
  ON public.network_interface_status (interface_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_interface_status_device_idx
  ON public.network_interface_status (device_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_interface_status_company_idx
  ON public.network_interface_status (company_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_interface_status IS
  'Current interface counters from monitoring polls. Inventory identity remains in network_interfaces.';

CREATE TRIGGER network_device_status_set_updated_at
  BEFORE UPDATE ON public.network_device_status
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE TRIGGER network_interface_status_set_updated_at
  BEFORE UPDATE ON public.network_interface_status
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_network_device_status_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_device public.network_devices%ROWTYPE;
BEGIN
  SELECT *
    INTO v_device
  FROM public.network_devices
  WHERE id = NEW.device_id
    AND deleted_at IS NULL;

  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'El estado operativo requiere un dispositivo existente.';
  END IF;

  IF v_device.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El estado operativo no puede asociarse a un dispositivo de otra empresa.';
  END IF;

  NEW.company_id := v_device.company_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_device_status_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_device_status
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_device_status_tenant();

CREATE OR REPLACE FUNCTION public.enforce_network_interface_status_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_iface public.network_interfaces%ROWTYPE;
BEGIN
  SELECT *
    INTO v_iface
  FROM public.network_interfaces
  WHERE id = NEW.interface_id
    AND deleted_at IS NULL;

  IF v_iface.id IS NULL THEN
    RAISE EXCEPTION 'El estado de interfaz requiere una interfaz existente.';
  END IF;

  IF v_iface.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El estado de interfaz no puede cruzar empresas.';
  END IF;

  IF v_iface.device_id IS DISTINCT FROM NEW.device_id THEN
    RAISE EXCEPTION 'El estado de interfaz no pertenece al dispositivo indicado.';
  END IF;

  NEW.company_id := v_iface.company_id;
  NEW.device_id := v_iface.device_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_interface_status_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_interface_status
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_interface_status_tenant();

ALTER TABLE public.network_device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_interface_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_device_status_select_policy
  ON public.network_device_status
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_device_status_insert_policy
  ON public.network_device_status
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_device_status_update_policy
  ON public.network_device_status
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_interface_status_select_policy
  ON public.network_interface_status
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_interface_status_insert_policy
  ON public.network_interface_status
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_interface_status_update_policy
  ON public.network_interface_status
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.network_device_status TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.network_interface_status TO authenticated;
