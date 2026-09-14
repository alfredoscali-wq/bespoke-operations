-- Bespoke Mobile — per-company chrome branding (logo URL + two colors).
-- Distinct from isp_billing_company_settings.logo_url (fiscal documents).
-- 1:1 with companies. No backfill. All visual fields nullable.

CREATE TABLE IF NOT EXISTS public.company_branding (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_branding_logo_url_check
    CHECK (
      logo_url IS NULL
      OR (
        btrim(logo_url) <> ''
        AND logo_url !~* '^\s*(javascript|data|vbscript):'
      )
    ),
  CONSTRAINT company_branding_primary_color_check
    CHECK (
      primary_color IS NULL
      OR primary_color ~ '^#[0-9A-Fa-f]{6}$'
    ),
  CONSTRAINT company_branding_secondary_color_check
    CHECK (
      secondary_color IS NULL
      OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'
    )
);

COMMENT ON TABLE public.company_branding IS
  'Chrome branding for Bespoke Mobile bootstrap. One row per company. Not billing/fiscal identity.';

COMMENT ON COLUMN public.company_branding.logo_url IS
  'Public URL or site-relative path for the company logo. Never binary. Nullable until configured.';

COMMENT ON COLUMN public.company_branding.primary_color IS
  'Hex color #RRGGBB for Mobile chrome. Nullable until configured.';

COMMENT ON COLUMN public.company_branding.secondary_color IS
  'Hex color #RRGGBB for Mobile chrome. Nullable until configured.';

CREATE OR REPLACE FUNCTION public.normalize_company_branding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.logo_url IS NOT NULL THEN
    NEW.logo_url := NULLIF(BTRIM(NEW.logo_url), '');
  END IF;

  IF NEW.primary_color IS NOT NULL THEN
    NEW.primary_color := NULLIF(upper(BTRIM(NEW.primary_color)), '');
  END IF;

  IF NEW.secondary_color IS NOT NULL THEN
    NEW.secondary_color := NULLIF(upper(BTRIM(NEW.secondary_color)), '');
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.normalize_company_branding() IS
  'Trims branding fields; blank becomes NULL; hex colors stored uppercase.';

REVOKE ALL ON FUNCTION public.normalize_company_branding() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_company_branding() FROM anon;
REVOKE ALL ON FUNCTION public.normalize_company_branding() FROM authenticated;

DROP TRIGGER IF EXISTS company_branding_normalize ON public.company_branding;
CREATE TRIGGER company_branding_normalize
  BEFORE INSERT OR UPDATE ON public.company_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_company_branding();

ALTER TABLE public.company_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_branding_select_policy ON public.company_branding;
CREATE POLICY company_branding_select_policy
  ON public.company_branding
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

GRANT SELECT ON TABLE public.company_branding TO authenticated;

-- No authenticated INSERT/UPDATE/DELETE: writes are service_role / future admin UI.
-- Bootstrap uses createAdminClient() and still filters by the company resolved via mobile_code.
