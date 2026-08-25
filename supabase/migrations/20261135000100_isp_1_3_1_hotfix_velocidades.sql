-- ISP 1.3.1 — Hotfix: download and upload speeds are independent.
-- Additive only. Does not invent upload values, prices, technology or connection types.
-- Reverts 1.3 auto-copied upload = download on known seed codes so they can be reviewed.

COMMENT ON COLUMN public.isp_service_catalog.upload_speed_mbps IS
  'Independent upstream speed. Never defaulted from download_speed_mbps.';
COMMENT ON COLUMN public.isp_service_catalog.download_speed_mbps IS
  'Independent downstream speed. Not assumed equal to upload_speed_mbps.';
COMMENT ON COLUMN public.isp_technical_profiles.upload_speed IS
  'Independent upstream speed of the technical profile. Never defaulted from download_speed.';
COMMENT ON COLUMN public.isp_technical_profiles.download_speed IS
  'Independent downstream speed of the technical profile. Not assumed equal to upload_speed.';

-- Catalog seeds where 1.3 copied bajada into subida. Keep download. Do not invent a new upload.
UPDATE public.isp_service_catalog
SET upload_speed_mbps = NULL
WHERE deleted_at IS NULL
  AND code IN ('FTTH-50', 'FTTH-100', 'FTTH-300')
  AND download_speed_mbps IS NOT NULL
  AND upload_speed_mbps IS NOT NULL
  AND upload_speed_mbps = download_speed_mbps;

-- Matching technical profiles seeded as symmetric by 1.3.
UPDATE public.isp_technical_profiles
SET upload_speed = NULL
WHERE deleted_at IS NULL
  AND code IN ('FTTH-50', 'FTTH-100', 'FTTH-300')
  AND download_speed IS NOT NULL
  AND upload_speed IS NOT NULL
  AND upload_speed = download_speed;
