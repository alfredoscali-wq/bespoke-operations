-- Bespoke Operations — Phase 2C: evidences table + storage bucket
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: projects and tasks migrations applied first (optional FKs)

CREATE TYPE public.evidence_file_type AS ENUM (
  'photo',
  'pdf',
  'plan',
  'video'
);

CREATE TYPE public.evidence_category_type AS ENUM (
  'initial-photo',
  'progress-photo',
  'final-photo',
  'otdr-certification',
  'plan',
  'client-document'
);

CREATE TYPE public.evidence_status AS ENUM (
  'pending-review',
  'approved',
  'rejected'
);

CREATE TABLE public.evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type public.evidence_file_type NOT NULL,
  evidence_type public.evidence_category_type NOT NULL DEFAULT 'progress-photo',
  storage_bucket text NOT NULL DEFAULT 'evidences',
  storage_path text,
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  preview_url text,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  project_code text NOT NULL,
  project_name text NOT NULL,
  task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  task_code text NOT NULL,
  task_title text NOT NULL,
  crew text NOT NULL,
  worker text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status public.evidence_status NOT NULL DEFAULT 'pending-review',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  upload_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX evidences_status_idx ON public.evidences (status);
CREATE INDEX evidences_file_type_idx ON public.evidences (file_type);
CREATE INDEX evidences_evidence_type_idx ON public.evidences (evidence_type);
CREATE INDEX evidences_project_id_idx ON public.evidences (project_id);
CREATE INDEX evidences_task_id_idx ON public.evidences (task_id);
CREATE INDEX evidences_uploaded_at_idx ON public.evidences (uploaded_at DESC);
CREATE INDEX evidences_deleted_at_idx ON public.evidences (deleted_at);

CREATE OR REPLACE FUNCTION public.set_evidences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER evidences_set_updated_at
  BEFORE UPDATE ON public.evidences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_evidences_updated_at();

ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidences_select_policy
  ON public.evidences
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY evidences_insert_policy
  ON public.evidences
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY evidences_update_policy
  ON public.evidences
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

COMMENT ON TABLE public.evidences IS 'Field evidence files linked to projects and tasks.';
COMMENT ON COLUMN public.evidences.storage_path IS 'Object path inside the evidences storage bucket.';
COMMENT ON COLUMN public.evidences.preview_url IS 'Optional fallback URL when storage signed URLs are not used.';

-- Storage bucket for evidence files (private — use signed URLs in the app)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidences',
  'evidences',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY evidences_storage_select
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'evidences');

CREATE POLICY evidences_storage_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'evidences');

CREATE POLICY evidences_storage_update
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'evidences');

CREATE POLICY evidences_storage_delete
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'evidences');
