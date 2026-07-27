-- Attachment Engine 1.0 — transversal file attachments.
-- Single table + private storage bucket. Module-agnostic (module + record_id).

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  module text NOT NULL,
  record_id uuid NOT NULL,
  timeline_event_id uuid NULL,
  original_name text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.employees (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachments_module_check CHECK (
    module IN (
      'customer_attention',
      'commercial',
      'projects',
      'tasks',
      'employees',
      'customers'
    )
  ),
  CONSTRAINT attachments_storage_path_unique UNIQUE (company_id, storage_path)
);

CREATE INDEX IF NOT EXISTS attachments_company_module_record_idx
  ON public.attachments (company_id, module, record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attachments_timeline_event_idx
  ON public.attachments (company_id, timeline_event_id)
  WHERE timeline_event_id IS NOT NULL;

COMMENT ON TABLE public.attachments IS
  'Attachment Engine 1.0 — reusable file metadata for all Bespoke modules.';

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attachments_select_policy ON public.attachments;
CREATE POLICY attachments_select_policy
  ON public.attachments
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
  );

DROP POLICY IF EXISTS attachments_insert_policy ON public.attachments;
CREATE POLICY attachments_insert_policy
  ON public.attachments
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND uploaded_by = public.auth_user_employee_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS attachments_delete_policy ON public.attachments;
CREATE POLICY attachments_delete_policy
  ON public.attachments
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_system_role() = 'administrador'
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- Private bucket: company_id / module / record_id / file_name
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'application/pdf',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'audio/wav',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS attachments_storage_select_policy ON storage.objects;
CREATE POLICY attachments_storage_select_policy
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  );

DROP POLICY IF EXISTS attachments_storage_insert_policy ON storage.objects;
CREATE POLICY attachments_storage_insert_policy
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS attachments_storage_update_policy ON storage.objects;
CREATE POLICY attachments_storage_update_policy
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS attachments_storage_delete_policy ON storage.objects;
CREATE POLICY attachments_storage_delete_policy
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
    AND public.auth_user_system_role() = 'administrador'
    AND NOT public.auth_is_demo_platform_read_only()
  );
