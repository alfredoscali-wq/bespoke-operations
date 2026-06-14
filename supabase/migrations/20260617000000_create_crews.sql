-- Bespoke Operations — Phase 4: crews and crew members
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: companies, projects, tasks migrations applied first

CREATE TYPE public.crew_status AS ENUM (
  'activa',
  'inactiva',
  'en-campo'
);

CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid
    REFERENCES public.companies (id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  supervisor text NOT NULL,
  status public.crew_status NOT NULL DEFAULT 'activa',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crews_company_name_unique UNIQUE (company_id, name)
);

CREATE INDEX crews_status_idx ON public.crews (status);
CREATE INDEX crews_deleted_at_idx ON public.crews (deleted_at);
CREATE INDEX crews_company_id_idx ON public.crews (company_id);

CREATE TABLE public.crew_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crews (id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX crew_members_crew_id_idx ON public.crew_members (crew_id);
CREATE INDEX crew_members_deleted_at_idx ON public.crew_members (deleted_at);

ALTER TABLE public.tasks
  ADD COLUMN crew_id uuid REFERENCES public.crews (id) ON DELETE SET NULL;

CREATE INDEX tasks_crew_id_idx ON public.tasks (crew_id);

CREATE OR REPLACE FUNCTION public.set_crews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crews_set_updated_at
  BEFORE UPDATE ON public.crews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_crews_updated_at();

CREATE OR REPLACE FUNCTION public.set_crew_members_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crew_members_set_updated_at
  BEFORE UPDATE ON public.crew_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_crew_members_updated_at();

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY crews_select_policy
  ON public.crews
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY crews_insert_policy
  ON public.crews
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY crews_update_policy
  ON public.crews
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

CREATE POLICY crew_members_select_policy
  ON public.crew_members
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY crew_members_insert_policy
  ON public.crew_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY crew_members_update_policy
  ON public.crew_members
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

COMMENT ON TABLE public.crews IS 'Field crews assigned to infrastructure tasks.';
COMMENT ON TABLE public.crew_members IS 'Members belonging to a crew.';
