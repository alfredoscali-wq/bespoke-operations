-- RC3.1.4.1 — task-incident-photos storage bucket (versioned infrastructure)
--
-- Mobile upload uses service role (admin client). Supervisor viewing uses signed URLs
-- via authenticated session — SELECT policy scopes access through task_incident_photos.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-incident-photos',
  'task-incident-photos',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS task_incident_photos_storage_select ON storage.objects;

CREATE POLICY task_incident_photos_storage_select
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'task-incident-photos'
    AND split_part(name, '/', 1)::uuid = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.task_incident_photos tip
      WHERE tip.storage_path = name
        AND public.auth_can_read_task_incident(tip.incident_id)
    )
  );
