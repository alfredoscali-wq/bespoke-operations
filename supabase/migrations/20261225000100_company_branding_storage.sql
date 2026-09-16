-- Company chrome logos for Operations + Mobile bootstrap.
-- Distinct from isp-billing-logos (fiscal documents).
-- Additive. Does not alter company_branding RLS (writes remain service_role).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-branding-logos',
  'company-branding-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS company_branding_logos_public_read ON storage.objects;

CREATE POLICY company_branding_logos_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-branding-logos');

COMMENT ON POLICY company_branding_logos_public_read ON storage.objects IS
  'Tenant chrome logos are public presentation assets used by Operations and Mobile.';
