-- Bespoke Operations — Phase 3: multi-tenant companies foundation
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: projects, tasks, evidences migrations applied first
--
-- Demo company UUID — keep in sync with lib/supabase/company.constants.ts
-- 00000000-0000-4000-8000-000000000001

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT companies_slug_unique UNIQUE (slug)
);

CREATE INDEX companies_deleted_at_idx ON public.companies (deleted_at);

CREATE OR REPLACE FUNCTION public.set_companies_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_companies_updated_at();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select_policy
  ON public.companies
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY companies_insert_policy
  ON public.companies
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY companies_update_policy
  ON public.companies
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

COMMENT ON TABLE public.companies IS 'Tenant organizations for multi-company SaaS.';

INSERT INTO public.companies (id, name, slug)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Bespoke Demo',
  'bespoke-demo'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug;

-- projects.company_id
ALTER TABLE public.projects
  ADD COLUMN company_id uuid;

UPDATE public.projects
SET company_id = '00000000-0000-4000-8000-000000000001'
WHERE company_id IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.projects
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT;

CREATE INDEX projects_company_id_idx ON public.projects (company_id);

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_code_unique;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_company_code_unique UNIQUE (company_id, code);

-- tasks.company_id
ALTER TABLE public.tasks
  ADD COLUMN company_id uuid;

UPDATE public.tasks
SET company_id = '00000000-0000-4000-8000-000000000001'
WHERE company_id IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.tasks
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT;

CREATE INDEX tasks_company_id_idx ON public.tasks (company_id);

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_code_unique;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_company_code_unique UNIQUE (company_id, code);

-- evidences.company_id
ALTER TABLE public.evidences
  ADD COLUMN company_id uuid;

UPDATE public.evidences
SET company_id = '00000000-0000-4000-8000-000000000001'
WHERE company_id IS NULL;

ALTER TABLE public.evidences
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.evidences
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE public.evidences
  ADD CONSTRAINT evidences_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT;

CREATE INDEX evidences_company_id_idx ON public.evidences (company_id);

COMMENT ON COLUMN public.projects.company_id IS 'Tenant owner of the project record.';
COMMENT ON COLUMN public.tasks.company_id IS 'Tenant owner of the task record.';
COMMENT ON COLUMN public.evidences.company_id IS 'Tenant owner of the evidence record.';
