-- Network 1 — Discovery foundation: devices, interfaces, links, MikroTik targets.
-- Does not alter isp_connections. MikroTik access lives in the Network Agent, not Cloud.

ALTER TABLE public.network_agents
  ALTER COLUMN site_id DROP NOT NULL;

ALTER TABLE public.network_agent_jobs
  ALTER COLUMN site_id DROP NOT NULL;

COMMENT ON COLUMN public.network_agents.site_id IS
  'Optional home site. An agent is a reachability point and may discover devices across many sites.';

COMMENT ON COLUMN public.network_agent_jobs.site_id IS
  'Optional site context for the job (e.g. discovery target site). Independent of the agent home site.';

CREATE OR REPLACE FUNCTION public.enforce_network_agent_site_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_site public.network_sites%ROWTYPE;
BEGIN
  IF NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_site
  FROM public.network_sites
  WHERE id = NEW.site_id
    AND deleted_at IS NULL;

  IF v_site.id IS NULL THEN
    RAISE EXCEPTION 'El agent requiere un sitio de infraestructura existente.';
  END IF;

  IF v_site.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El agent no puede asociarse a un sitio de otra empresa.';
  END IF;

  NEW.company_id := v_site.company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_network_job_agent_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent public.network_agents%ROWTYPE;
  v_site_company uuid;
BEGIN
  SELECT *
    INTO v_agent
  FROM public.network_agents
  WHERE id = NEW.agent_id
    AND deleted_at IS NULL;

  IF v_agent.id IS NULL THEN
    RAISE EXCEPTION 'El job requiere un Network Agent existente.';
  END IF;

  IF v_agent.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El job no puede asociarse a un agent de otra empresa.';
  END IF;

  NEW.company_id := v_agent.company_id;

  IF NEW.site_id IS NOT NULL THEN
    SELECT company_id
      INTO v_site_company
    FROM public.network_sites
    WHERE id = NEW.site_id
      AND deleted_at IS NULL;

    IF v_site_company IS NULL THEN
      RAISE EXCEPTION 'El job requiere un sitio de infraestructura existente.';
    END IF;

    IF v_site_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El job no puede asociarse a un sitio de otra empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE public.network_discovery_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  agent_id uuid NOT NULL REFERENCES public.network_agents (id),
  site_id uuid REFERENCES public.network_sites (id),
  name text NOT NULL,
  vendor text NOT NULL
    CHECK (vendor IN ('mikrotik', 'ubiquiti', 'zte', 'huawei', 'vsol')),
  host text NOT NULL,
  port integer NOT NULL,
  protocol text NOT NULL
    CHECK (protocol IN ('api', 'rest')),
  username text NOT NULL,
  secret_ciphertext text NOT NULL,
  secret_iv text NOT NULL,
  secret_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_discovery_targets_name_not_blank
    CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT network_discovery_targets_host_not_blank
    CHECK (char_length(btrim(host)) > 0),
  CONSTRAINT network_discovery_targets_username_not_blank
    CHECK (char_length(btrim(username)) > 0),
  CONSTRAINT network_discovery_targets_port_range
    CHECK (port > 0 AND port <= 65535)
);

CREATE INDEX network_discovery_targets_company_idx
  ON public.network_discovery_targets (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_discovery_targets_agent_idx
  ON public.network_discovery_targets (agent_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_discovery_targets IS
  'Authorized discovery target for a Network Agent. Device passwords are AES-256-GCM ciphertext, never plaintext.';
COMMENT ON COLUMN public.network_discovery_targets.secret_ciphertext IS
  'AES-256-GCM ciphertext of the device password. Never returned to UI.';

CREATE TABLE public.network_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  agent_id uuid REFERENCES public.network_agents (id),
  site_id uuid REFERENCES public.network_sites (id),
  fingerprint text NOT NULL,
  hostname text,
  manufacturer text,
  model text,
  serial_number text,
  device_type text NOT NULL DEFAULT 'other'
    CHECK (device_type IN (
      'core',
      'router',
      'switch',
      'ap',
      'radio',
      'olt',
      'onu',
      'cpe',
      'other'
    )),
  management_ip text,
  mac_address text,
  firmware_version text,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'online', 'offline', 'degraded', 'maintenance')),
  origin text NOT NULL DEFAULT 'discovery'
    CHECK (origin IN ('discovery', 'neighbor')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_devices_fingerprint_not_blank
    CHECK (char_length(btrim(fingerprint)) > 0)
);

CREATE UNIQUE INDEX network_devices_company_fingerprint_idx
  ON public.network_devices (company_id, fingerprint)
  WHERE deleted_at IS NULL;

CREATE INDEX network_devices_company_idx
  ON public.network_devices (company_id, last_seen_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX network_devices_site_idx
  ON public.network_devices (site_id)
  WHERE deleted_at IS NULL AND site_id IS NOT NULL;

CREATE INDEX network_devices_agent_idx
  ON public.network_devices (agent_id)
  WHERE deleted_at IS NULL AND agent_id IS NOT NULL;

COMMENT ON TABLE public.network_devices IS
  'Network infrastructure inventory. Independent from isp_connections (subscriber circuits).';

CREATE TABLE public.network_interfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  device_id uuid NOT NULL REFERENCES public.network_devices (id),
  name text NOT NULL,
  description text,
  mac_address text,
  addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text,
  speed_mbps integer,
  interface_type text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_interfaces_name_not_blank
    CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX network_interfaces_device_name_idx
  ON public.network_interfaces (device_id, lower(btrim(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX network_interfaces_company_idx
  ON public.network_interfaces (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_interfaces_device_idx
  ON public.network_interfaces (device_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_interfaces IS
  'Discovered device interfaces and current IPs. No historical metrics.';

CREATE TABLE public.network_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  from_device_id uuid NOT NULL REFERENCES public.network_devices (id),
  from_interface_id uuid REFERENCES public.network_interfaces (id),
  to_device_id uuid NOT NULL REFERENCES public.network_devices (id),
  to_interface_id uuid REFERENCES public.network_interfaces (id),
  protocol text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_links_not_self
    CHECK (from_device_id <> to_device_id)
);

CREATE UNIQUE INDEX network_links_edge_idx
  ON public.network_links (
    company_id,
    from_device_id,
    to_device_id,
    coalesce(from_interface_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(to_interface_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL;

CREATE INDEX network_links_company_idx
  ON public.network_links (company_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_links IS
  'Discovered adjacency: device A / interface A → device B / interface B. Graph rendering is out of scope.';

CREATE TRIGGER network_discovery_targets_set_updated_at
  BEFORE UPDATE ON public.network_discovery_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE TRIGGER network_devices_set_updated_at
  BEFORE UPDATE ON public.network_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE TRIGGER network_interfaces_set_updated_at
  BEFORE UPDATE ON public.network_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE TRIGGER network_links_set_updated_at
  BEFORE UPDATE ON public.network_links
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_network_target_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent public.network_agents%ROWTYPE;
  v_site_company uuid;
BEGIN
  SELECT *
    INTO v_agent
  FROM public.network_agents
  WHERE id = NEW.agent_id
    AND deleted_at IS NULL;

  IF v_agent.id IS NULL THEN
    RAISE EXCEPTION 'El destino de discovery requiere un Network Agent existente.';
  END IF;

  IF v_agent.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El destino de discovery no puede asociarse a un agent de otra empresa.';
  END IF;

  NEW.company_id := v_agent.company_id;

  IF NEW.site_id IS NOT NULL THEN
    SELECT company_id
      INTO v_site_company
    FROM public.network_sites
    WHERE id = NEW.site_id
      AND deleted_at IS NULL;

    IF v_site_company IS NULL THEN
      RAISE EXCEPTION 'El destino de discovery requiere un sitio existente.';
    END IF;

    IF v_site_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El destino de discovery no puede asociarse a un sitio de otra empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER network_discovery_targets_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_discovery_targets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_target_tenant();

CREATE OR REPLACE FUNCTION public.enforce_network_device_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF NEW.agent_id IS NOT NULL THEN
    SELECT company_id
      INTO v_company
    FROM public.network_agents
    WHERE id = NEW.agent_id
      AND deleted_at IS NULL;

    IF v_company IS NULL THEN
      RAISE EXCEPTION 'El dispositivo requiere un Network Agent existente.';
    END IF;

    IF v_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El dispositivo no puede asociarse a un agent de otra empresa.';
    END IF;
  END IF;

  IF NEW.site_id IS NOT NULL THEN
    SELECT company_id
      INTO v_company
    FROM public.network_sites
    WHERE id = NEW.site_id
      AND deleted_at IS NULL;

    IF v_company IS NULL THEN
      RAISE EXCEPTION 'El dispositivo requiere un sitio existente.';
    END IF;

    IF v_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El dispositivo no puede asociarse a un sitio de otra empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER network_devices_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_devices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_device_tenant();

CREATE OR REPLACE FUNCTION public.enforce_network_interface_tenant()
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
    RAISE EXCEPTION 'La interfaz requiere un dispositivo existente.';
  END IF;

  IF v_device.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La interfaz no puede asociarse a un dispositivo de otra empresa.';
  END IF;

  NEW.company_id := v_device.company_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_interfaces_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_interface_tenant();

CREATE OR REPLACE FUNCTION public.enforce_network_link_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_from public.network_devices%ROWTYPE;
  v_to public.network_devices%ROWTYPE;
  v_if_company uuid;
BEGIN
  SELECT *
    INTO v_from
  FROM public.network_devices
  WHERE id = NEW.from_device_id
    AND deleted_at IS NULL;

  SELECT *
    INTO v_to
  FROM public.network_devices
  WHERE id = NEW.to_device_id
    AND deleted_at IS NULL;

  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    RAISE EXCEPTION 'El enlace requiere dispositivos existentes.';
  END IF;

  IF v_from.company_id IS DISTINCT FROM NEW.company_id
     OR v_to.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El enlace no puede cruzar empresas.';
  END IF;

  NEW.company_id := v_from.company_id;

  IF NEW.from_interface_id IS NOT NULL THEN
    SELECT company_id
      INTO v_if_company
    FROM public.network_interfaces
    WHERE id = NEW.from_interface_id
      AND device_id = NEW.from_device_id
      AND deleted_at IS NULL;

    IF v_if_company IS NULL THEN
      RAISE EXCEPTION 'La interfaz de origen no pertenece al dispositivo de origen.';
    END IF;
  END IF;

  IF NEW.to_interface_id IS NOT NULL THEN
    SELECT company_id
      INTO v_if_company
    FROM public.network_interfaces
    WHERE id = NEW.to_interface_id
      AND device_id = NEW.to_device_id
      AND deleted_at IS NULL;

    IF v_if_company IS NULL THEN
      RAISE EXCEPTION 'La interfaz de destino no pertenece al dispositivo de destino.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER network_links_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_link_tenant();

ALTER TABLE public.network_discovery_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_interfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_discovery_targets_select_policy
  ON public.network_discovery_targets
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_discovery_targets_insert_policy
  ON public.network_discovery_targets
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_discovery_targets_update_policy
  ON public.network_discovery_targets
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

CREATE POLICY network_devices_select_policy
  ON public.network_devices
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_devices_insert_policy
  ON public.network_devices
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_devices_update_policy
  ON public.network_devices
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

CREATE POLICY network_interfaces_select_policy
  ON public.network_interfaces
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_interfaces_insert_policy
  ON public.network_interfaces
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_interfaces_update_policy
  ON public.network_interfaces
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

CREATE POLICY network_links_select_policy
  ON public.network_links
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_links_insert_policy
  ON public.network_links
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_links_update_policy
  ON public.network_links
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

GRANT SELECT, INSERT, UPDATE ON public.network_discovery_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.network_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.network_interfaces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.network_links TO authenticated;
