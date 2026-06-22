-- SPRINT TAREAS 2.2 — reference photos for crew (align schema + photo_type)

ALTER TABLE public.task_photos
  ADD COLUMN IF NOT EXISTS photo_type text NOT NULL DEFAULT 'reference',
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid NULL;

UPDATE public.task_photos
SET description = caption
WHERE description = '' AND caption IS NOT NULL AND caption <> '';

UPDATE public.task_photos
SET file_url = storage_path
WHERE file_url IS NULL AND storage_path IS NOT NULL AND storage_path <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'task_photos_photo_type_check'
  ) THEN
    ALTER TABLE public.task_photos
      ADD CONSTRAINT task_photos_photo_type_check
      CHECK (photo_type IN ('reference', 'evidence'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS task_photos_task_id_photo_type_idx
  ON public.task_photos (task_id, photo_type);

COMMENT ON COLUMN public.task_photos.photo_type IS
  'Photo role: reference (crew context) or evidence (field proof).';

COMMENT ON COLUMN public.task_photos.file_url IS
  'Storage object path inside task-photos bucket (signed URLs generated at read time).';

COMMENT ON COLUMN public.task_photos.description IS
  'Optional operational description shown to the assigned crew.';

COMMENT ON COLUMN public.task_photos.created_by IS
  'Optional profile/user id of the uploader.';
