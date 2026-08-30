-- Network 0 — Foundation: sites, agents, jobs.
-- Does not alter isp_connections, Mobile API, Activity/Audit engines, or OT.
-- Device inventory and topology graphs are out of scope for this sprint.

CREATE TABLE public.network_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  name text NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('pop', 'node', 'tower', 'datacenter', 'office', 'other')),
  description text,
  address text,
  locality text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_sites_name_not_blank
    CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX network_sites_company_name_idx
  ON public.network_sites (company_id, lower(btrim(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX network_sites_company_idx
  ON public.network_sites (company_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_sites IS
  'Infrastructure site (POP, node, tower, datacenter, office). Not a customer address.';

CREATE TABLE public.network_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  site_id uuid NOT NULL REFERENCES public.network_sites (id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'online', 'degraded', 'offline', 'maintenance')),
  version text,
  hostname text,
  last_seen_at timestamptz,
  enrolled_at timestamptz,
  enrollment_token_hash text,
  enrollment_expires_at timestamptz,
  credential_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_agents_name_not_blank
    CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX network_agents_enrollment_token_hash_idx
  ON public.network_agents (enrollment_token_hash)
  WHERE enrollment_token_hash IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX network_agents_credential_token_hash_idx
  ON public.network_agents (credential_token_hash)
  WHERE credential_token_hash IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX network_agents_company_idx
  ON public.network_agents (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_agents_site_idx
  ON public.network_agents (site_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_agents_company_status_idx
  ON public.network_agents (company_id, status)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_agents IS
  'Bespoke Network Agent identity. Tenant is always taken from this row, never from agent payload.';
COMMENT ON COLUMN public.network_agents.enrollment_token_hash IS
  'SHA-256 of one-time enrollment token. Cleared after successful enroll.';
COMMENT ON COLUMN public.network_agents.credential_token_hash IS
  'SHA-256 of long-lived agent credential. Lookup key for Agent API.';

CREATE TABLE public.network_agent_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  agent_id uuid NOT NULL REFERENCES public.network_agents (id),
  site_id uuid NOT NULL REFERENCES public.network_sites (id),
  job_type text NOT NULL
    CHECK (job_type IN (
      'discovery',
      'monitoring',
      'backup',
      'diagnostic',
      'command',
      'verification'
    )),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'dispatched',
      'running',
      'completed',
      'failed',
      'cancelled'
    )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  dispatched_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX network_agent_jobs_company_idx
  ON public.network_agent_jobs (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_agent_jobs_agent_idx
  ON public.network_agent_jobs (agent_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX network_agent_jobs_company_status_idx
  ON public.network_agent_jobs (company_id, status)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_agent_jobs IS
  'Cloud → Agent job contract. Sprint 0 only creates pending jobs; execution is out of scope.';

CREATE OR REPLACE FUNCTION public.set_network_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_sites_set_updated_at
  BEFORE UPDATE ON public.network_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE TRIGGER network_agents_set_updated_at
  BEFORE UPDATE ON public.network_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE TRIGGER network_agent_jobs_set_updated_at
  BEFORE UPDATE ON public.network_agent_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_network_agent_site_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_site public.network_sites%ROWTYPE;
BEGIN
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

CREATE TRIGGER network_agents_enforce_site_company
  BEFORE INSERT OR UPDATE ON public.network_agents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_agent_site_company();

CREATE OR REPLACE FUNCTION public.enforce_network_job_agent_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent public.network_agents%ROWTYPE;
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
  NEW.site_id := v_agent.site_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_agent_jobs_enforce_agent_company
  BEFORE INSERT OR UPDATE ON public.network_agent_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_job_agent_company();

ALTER TABLE public.network_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_agent_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_sites_select_policy
  ON public.network_sites
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_sites_insert_policy
  ON public.network_sites
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_sites_update_policy
  ON public.network_sites
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

CREATE POLICY network_agents_select_policy
  ON public.network_agents
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_agents_insert_policy
  ON public.network_agents
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_agents_update_policy
  ON public.network_agents
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

CREATE POLICY network_agent_jobs_select_policy
  ON public.network_agent_jobs
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_agent_jobs_insert_policy
  ON public.network_agent_jobs
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_agent_jobs_update_policy
  ON public.network_agent_jobs
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

GRANT SELECT, INSERT, UPDATE ON public.network_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.network_agents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.network_agent_jobs TO authenticated;

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"network": true}'::jsonb
WHERE code IN (
  'administrador',
  'administracion',
  'tecnica',
  'supervisor'
);

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"network": false}'::jsonb
WHERE code IN (
  'atencion_cliente',
  'ventas',
  'rrhh',
  'operario'
);
