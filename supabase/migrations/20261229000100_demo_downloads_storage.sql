-- Public demo/distribution assets (APK, etc.).
-- Additive. Creates only the demo-downloads bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'demo-downloads',
  'demo-downloads',
  true,
  104857600,
  ARRAY[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS demo_downloads_public_read ON storage.objects;

CREATE POLICY demo_downloads_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'demo-downloads');

COMMENT ON POLICY demo_downloads_public_read ON storage.objects IS
  'Public demo distribution files such as the Bespoke Mobile APK.';
