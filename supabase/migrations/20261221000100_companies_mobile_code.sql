-- Bespoke Mobile — companyCode identifier on companies.
-- Nullable so existing tenants stay valid until Administración assigns a code.
-- Unique case-insensitively. Not a UUID. Does not alter slug or generate codes.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS mobile_code text;

COMMENT ON COLUMN public.companies.mobile_code IS
  'Stable Bespoke Mobile company code. Nullable until configured. Unique case-insensitively. Independent of slug, name, and company UUID.';

CREATE OR REPLACE FUNCTION public.normalize_companies_mobile_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mobile_code IS NOT NULL THEN
    NEW.mobile_code := NULLIF(lower(BTRIM(NEW.mobile_code)), '');
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.normalize_companies_mobile_code() IS
  'Trims and lowercases companies.mobile_code. Blank becomes NULL. Does not invent a code.';

REVOKE ALL ON FUNCTION public.normalize_companies_mobile_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_companies_mobile_code() FROM anon;
REVOKE ALL ON FUNCTION public.normalize_companies_mobile_code() FROM authenticated;

DROP TRIGGER IF EXISTS companies_normalize_mobile_code ON public.companies;
CREATE TRIGGER companies_normalize_mobile_code
  BEFORE INSERT OR UPDATE OF mobile_code ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_companies_mobile_code();

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_mobile_code_format_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_mobile_code_format_check
  CHECK (
    mobile_code IS NULL
    OR (
      char_length(mobile_code) <= 32
      AND mobile_code !~ '\s'
      AND mobile_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  );

DROP INDEX IF EXISTS public.companies_mobile_code_lower_uidx;
CREATE UNIQUE INDEX companies_mobile_code_lower_uidx
  ON public.companies (lower(mobile_code))
  WHERE mobile_code IS NOT NULL;

COMMENT ON INDEX public.companies_mobile_code_lower_uidx IS
  'One active mobile_code per tenant, compared case-insensitively. Multiple NULLs are allowed.';
