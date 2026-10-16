-- MikroTik Integration 1.0 — routers RouterOS REST por empresa.
-- Credenciales cifradas server-side (password_encrypted). Sin plaintext.
-- Escrituras y descifrado solo via service_role + company_id de sesion.

CREATE TABLE IF NOT EXISTS public.company_mikrotik_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL,
  protocol text NOT NULL,
  username text NOT NULL,
  password_encrypted text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_connection_at timestamptz,
  last_connection_status text NOT NULL DEFAULT 'never_checked',
  last_connection_error text,
  last_router_identity jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT company_mikrotik_integrations_name_not_blank
    CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT company_mikrotik_integrations_host_not_blank
    CHECK (char_length(btrim(host)) > 0),
  CONSTRAINT company_mikrotik_integrations_username_not_blank
    CHECK (char_length(btrim(username)) > 0),
  CONSTRAINT company_mikrotik_integrations_password_not_blank
    CHECK (char_length(password_encrypted) > 0),
  CONSTRAINT company_mikrotik_integrations_port_range
    CHECK (port >= 1 AND port <= 65535),
  CONSTRAINT company_mikrotik_integrations_protocol_check
    CHECK (protocol IN ('https-rest', 'api', 'api-ssl')),
  CONSTRAINT company_mikrotik_integrations_status_check
    CHECK (
      last_connection_status IN (
        'never_checked',
        'connected',
        'error',
        'disabled'
      )
    )
);

COMMENT ON TABLE public.company_mikrotik_integrations IS
  'MikroTik Integration 1.0 — routers RouterOS por empresa. password_encrypted is AES-256-GCM packed ciphertext; never plaintext.';

COMMENT ON COLUMN public.company_mikrotik_integrations.password_encrypted IS
  'AES-256-GCM packed secret (aes256gcm.v1.iv.tag.ciphertext). Encrypted with BESPOKE_MIKROTIK_SECRET. Never returned to clients.';

COMMENT ON COLUMN public.company_mikrotik_integrations.protocol IS
  'https-rest is implemented in 1.0. api and api-ssl are reserved for later TCP API adapters.';

COMMENT ON COLUMN public.company_mikrotik_integrations.last_router_identity IS
  'Compact identity/resource snapshot from the last successful connection test. No full router config.';

CREATE INDEX IF NOT EXISTS company_mikrotik_integrations_company_id_idx
  ON public.company_mikrotik_integrations (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS company_mikrotik_integrations_company_status_idx
  ON public.company_mikrotik_integrations (company_id, last_connection_status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_company_mikrotik_integrations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_company_mikrotik_integrations_updated_at() IS
  'Maintains company_mikrotik_integrations.updated_at on write.';

REVOKE ALL ON FUNCTION public.set_company_mikrotik_integrations_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_company_mikrotik_integrations_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_company_mikrotik_integrations_updated_at() FROM authenticated;

DROP TRIGGER IF EXISTS company_mikrotik_integrations_set_updated_at
  ON public.company_mikrotik_integrations;
CREATE TRIGGER company_mikrotik_integrations_set_updated_at
  BEFORE INSERT OR UPDATE ON public.company_mikrotik_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_mikrotik_integrations_updated_at();

ALTER TABLE public.company_mikrotik_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_mikrotik_integrations_select_policy
  ON public.company_mikrotik_integrations;
CREATE POLICY company_mikrotik_integrations_select_policy
  ON public.company_mikrotik_integrations
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND deleted_at IS NULL
  );

REVOKE ALL ON TABLE public.company_mikrotik_integrations FROM PUBLIC;
REVOKE ALL ON TABLE public.company_mikrotik_integrations FROM anon;
REVOKE ALL ON TABLE public.company_mikrotik_integrations FROM authenticated;

GRANT SELECT (
  id,
  company_id,
  name,
  host,
  port,
  protocol,
  username,
  enabled,
  last_connection_at,
  last_connection_status,
  last_connection_error,
  last_router_identity,
  created_at,
  updated_at,
  deleted_at
) ON TABLE public.company_mikrotik_integrations TO authenticated;

GRANT ALL ON TABLE public.company_mikrotik_integrations TO service_role;
