-- ISP 1.7.1 — Make billing logos readable from public URLs used by preview/PDF.
-- Additive. Does not alter fiscal snapshots, documents, or taxes.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'isp-billing-logos',
  'isp-billing-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS isp_billing_logos_public_read ON storage.objects;

CREATE POLICY isp_billing_logos_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'isp-billing-logos');

COMMENT ON POLICY isp_billing_logos_public_read ON storage.objects IS
  'Company billing logos are public presentation assets, not secrets.';
