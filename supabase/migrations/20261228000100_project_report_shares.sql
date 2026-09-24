-- Informe de Obra 1.0 — password-protected shareable report links.
-- One active share per company + project. Token is stored hashed (SHA-256)
-- and encrypted at rest (AES-256-GCM) so owners can copy the URL without
-- keeping the plaintext token in the row.

CREATE TABLE IF NOT EXISTS public.project_report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  token_ciphertext text NOT NULL,
  password_hash text,
  is_password_protected boolean NOT NULL DEFAULT true,
  task_scope text NOT NULL DEFAULT 'completed',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_report_shares_token_hash_key UNIQUE (token_hash),
  CONSTRAINT project_report_shares_task_scope_check
    CHECK (task_scope IN ('all', 'completed')),
  CONSTRAINT project_report_shares_password_check
    CHECK (
      (is_password_protected = false AND password_hash IS NULL)
      OR (is_password_protected = true AND password_hash IS NOT NULL)
    )
);

COMMENT ON TABLE public.project_report_shares IS
  'Informe de Obra 1.0 — shareable read-only report links. Token is hashed; password uses scrypt.';

COMMENT ON COLUMN public.project_report_shares.token_hash IS
  'SHA-256 hex of the unguessable share token. Used for lookup. Never store the raw token.';

COMMENT ON COLUMN public.project_report_shares.token_ciphertext IS
  'AES-256-GCM ciphertext of the token so the owner can copy the Bespoke URL later.';

COMMENT ON COLUMN public.project_report_shares.password_hash IS
  'scrypt password hash. Never store or return the plaintext password.';

CREATE UNIQUE INDEX IF NOT EXISTS project_report_shares_one_active_per_project
  ON public.project_report_shares (company_id, project_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS project_report_shares_company_project_idx
  ON public.project_report_shares (company_id, project_id);

CREATE OR REPLACE FUNCTION public.set_project_report_shares_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_project_report_shares_updated_at() IS
  'Maintains project_report_shares.updated_at on write.';

REVOKE ALL ON FUNCTION public.set_project_report_shares_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_project_report_shares_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_project_report_shares_updated_at() FROM authenticated;

DROP TRIGGER IF EXISTS project_report_shares_set_updated_at
  ON public.project_report_shares;
CREATE TRIGGER project_report_shares_set_updated_at
  BEFORE INSERT OR UPDATE ON public.project_report_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_report_shares_updated_at();

ALTER TABLE public.project_report_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_report_shares_select_policy
  ON public.project_report_shares;
CREATE POLICY project_report_shares_select_policy
  ON public.project_report_shares
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS project_report_shares_insert_policy
  ON public.project_report_shares;
CREATE POLICY project_report_shares_insert_policy
  ON public.project_report_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS project_report_shares_update_policy
  ON public.project_report_shares;
CREATE POLICY project_report_shares_update_policy
  ON public.project_report_shares
  FOR UPDATE
  TO authenticated
  USING (company_id = public.auth_user_company_id())
  WITH CHECK (company_id = public.auth_user_company_id());

GRANT SELECT, INSERT, UPDATE ON TABLE public.project_report_shares TO authenticated;
GRANT ALL ON TABLE public.project_report_shares TO service_role;

REVOKE ALL ON TABLE public.project_report_shares FROM anon;
