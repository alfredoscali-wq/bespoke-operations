-- Bespoke Operations — Phase 2B: tasks table
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push

CREATE TYPE public.task_type AS ENUM (
  'fiber',
  'camera',
  'wireless',
  'pole',
  'maintenance',
  'inspection'
);

CREATE TYPE public.task_status AS ENUM (
  'pendiente',
  'asignada',
  'en-curso',
  'finalizada',
  'en-aprobacion',
  'cerrada'
);

CREATE TYPE public.task_priority AS ENUM (
  'alta',
  'media',
  'baja'
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  project_code text NOT NULL,
  project_name text NOT NULL,
  type public.task_type NOT NULL,
  status public.task_status NOT NULL DEFAULT 'pendiente',
  priority public.task_priority NOT NULL DEFAULT 'media',
  supervisor text NOT NULL,
  crew text NOT NULL,
  start_date date NOT NULL,
  due_date date NOT NULL,
  estimated_duration text NOT NULL DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  progress smallint NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT tasks_code_unique UNIQUE (code),
  CONSTRAINT tasks_dates_valid CHECK (due_date >= start_date)
);

CREATE INDEX tasks_status_idx ON public.tasks (status);
CREATE INDEX tasks_type_idx ON public.tasks (type);
CREATE INDEX tasks_project_code_idx ON public.tasks (project_code);
CREATE INDEX tasks_deleted_at_idx ON public.tasks (deleted_at);

CREATE OR REPLACE FUNCTION public.set_tasks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tasks_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select_policy
  ON public.tasks
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY tasks_insert_policy
  ON public.tasks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY tasks_update_policy
  ON public.tasks
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

COMMENT ON TABLE public.tasks IS 'Field activities linked to infrastructure projects.';
