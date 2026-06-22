-- SPRINT TAREAS 2.0 — geolocation confirmation + task photos foundation (Phase 2 structure only)

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

COMMENT ON COLUMN public.tasks.latitude IS
  'Optional GPS latitude for field service / work orders.';

COMMENT ON COLUMN public.tasks.longitude IS
  'Optional GPS longitude for field service / work orders.';

CREATE TABLE IF NOT EXISTS public.task_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  company_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid
    REFERENCES public.companies (id),
  storage_bucket text NOT NULL DEFAULT 'task-photos',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  caption text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL DEFAULT '',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS task_photos_task_id_idx
  ON public.task_photos (task_id);

CREATE INDEX IF NOT EXISTS task_photos_deleted_at_idx
  ON public.task_photos (deleted_at);

CREATE OR REPLACE FUNCTION public.set_task_photos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_photos_set_updated_at ON public.task_photos;

CREATE TRIGGER task_photos_set_updated_at
  BEFORE UPDATE ON public.task_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_photos_updated_at();

ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_photos_select_policy
  ON public.task_photos
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY task_photos_insert_policy
  ON public.task_photos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY task_photos_update_policy
  ON public.task_photos
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

COMMENT ON TABLE public.task_photos IS
  'Task photo attachments (Sprint TAREAS 2.0 Phase 2 foundation — upload UI pending).';

COMMENT ON COLUMN public.task_photos.storage_bucket IS
  'Supabase Storage bucket name. Default: task-photos.';

COMMENT ON COLUMN public.task_photos.storage_path IS
  'Object path inside the task-photos storage bucket.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY task_photos_storage_select
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'task-photos');

CREATE POLICY task_photos_storage_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'task-photos');

CREATE POLICY task_photos_storage_update
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'task-photos');

CREATE POLICY task_photos_storage_delete
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'task-photos');
