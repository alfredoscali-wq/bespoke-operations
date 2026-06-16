-- Bespoke Operations — RRHH Etapa 3: link crew_members to employees
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: employees migration applied first

ALTER TABLE public.crew_members
  ADD COLUMN employee_id uuid REFERENCES public.employees (id);

CREATE UNIQUE INDEX crew_members_crew_employee_unique
  ON public.crew_members (crew_id, employee_id)
  WHERE deleted_at IS NULL AND employee_id IS NOT NULL;

COMMENT ON COLUMN public.crew_members.employee_id IS
  'Optional link to employees directory. Legacy rows may remain NULL.';
