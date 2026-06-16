-- Bespoke Operations — Sprint 4.1: employee availability and absences
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: employees migration applied first

CREATE TABLE public.employee_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid
    REFERENCES public.companies (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  availability_type text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT employee_availability_date_range CHECK (end_date >= start_date)
);

CREATE INDEX employee_availability_employee_id_idx
  ON public.employee_availability (employee_id);

CREATE INDEX employee_availability_start_date_idx
  ON public.employee_availability (start_date);

CREATE INDEX employee_availability_end_date_idx
  ON public.employee_availability (end_date);

CREATE INDEX employee_availability_deleted_at_idx
  ON public.employee_availability (deleted_at);

CREATE OR REPLACE FUNCTION public.set_employee_availability_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER employee_availability_set_updated_at
  BEFORE UPDATE ON public.employee_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employee_availability_updated_at();

ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_availability_select_policy
  ON public.employee_availability
  FOR SELECT
  USING (true);

CREATE POLICY employee_availability_insert_policy
  ON public.employee_availability
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY employee_availability_update_policy
  ON public.employee_availability
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY employee_availability_delete_policy
  ON public.employee_availability
  FOR DELETE
  USING (true);

COMMENT ON TABLE public.employee_availability IS
  'Employee availability windows and absences for operational planning.';
