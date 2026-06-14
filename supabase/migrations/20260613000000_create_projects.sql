-- Bespoke Operations — Phase 2: projects table
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push

CREATE TYPE public.project_type AS ENUM (
  'fiber',
  'camera',
  'wireless',
  'pole',
  'maintenance'
);

CREATE TYPE public.project_status AS ENUM (
  'planned',
  'active',
  'paused',
  'pending-closure',
  'closed'
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  client text NOT NULL,
  type public.project_type NOT NULL,
  status public.project_status NOT NULL DEFAULT 'planned',
  progress smallint NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date date NOT NULL,
  end_date date NOT NULL,
  supervisor text NOT NULL,
  location text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT projects_code_unique UNIQUE (code),
  CONSTRAINT projects_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX projects_status_idx ON public.projects (status);
CREATE INDEX projects_type_idx ON public.projects (type);
CREATE INDEX projects_deleted_at_idx ON public.projects (deleted_at);

CREATE OR REPLACE FUNCTION public.set_projects_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_projects_updated_at();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Development policies (replace when auth + role-based RLS is implemented)
CREATE POLICY projects_select_policy
  ON public.projects
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY projects_insert_policy
  ON public.projects
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY projects_update_policy
  ON public.projects
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

COMMENT ON TABLE public.projects IS 'Infrastructure deployment projects (obras).';
