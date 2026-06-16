-- Bespoke Operations — Sprint OBRAS 1: operational lifecycle, pause metadata, history, archive

ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS pause_notes text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

CREATE TABLE IF NOT EXISTS public.project_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_history_project_id_idx
  ON public.project_history (project_id, created_at DESC);

ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_history_select_policy
  ON public.project_history
  FOR SELECT
  USING (true);

CREATE POLICY project_history_insert_policy
  ON public.project_history
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS projects_update_policy ON public.projects;

CREATE POLICY projects_update_policy
  ON public.projects
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (true);

COMMENT ON COLUMN public.projects.pause_reason IS 'Operational pause reason code (climatic, client, etc.)';
COMMENT ON TABLE public.project_history IS 'Chronological audit trail for project operational events.';
