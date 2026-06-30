-- Bespoke Operations — AGENT 0.7: operational work team shifts (jornada operativa)
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: companies, crews, mobile_devices, employees, auth_is_demo_platform_read_only()

CREATE TYPE public.work_team_shift_status AS ENUM ('NOT_STARTED', 'ACTIVE', 'FINISHED');

CREATE TABLE public.work_team_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  work_team_id uuid NOT NULL REFERENCES public.crews (id) ON DELETE RESTRICT,
  mobile_device_id uuid NOT NULL REFERENCES public.mobile_devices (id) ON DELETE RESTRICT,
  started_by uuid NOT NULL REFERENCES public.employees (id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  finished_at timestamptz,
  start_latitude double precision NOT NULL,
  start_longitude double precision NOT NULL,
  end_latitude double precision,
  end_longitude double precision,
  status public.work_team_shift_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX work_team_shifts_one_active_per_team
  ON public.work_team_shifts (company_id, work_team_id)
  WHERE status = 'ACTIVE';

CREATE INDEX work_team_shifts_company_id_idx
  ON public.work_team_shifts (company_id);

CREATE INDEX work_team_shifts_work_team_id_idx
  ON public.work_team_shifts (work_team_id);

CREATE INDEX work_team_shifts_mobile_device_id_idx
  ON public.work_team_shifts (mobile_device_id);

CREATE INDEX work_team_shifts_status_idx
  ON public.work_team_shifts (status);

CREATE OR REPLACE FUNCTION public.set_work_team_shifts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_team_shifts_set_updated_at
  BEFORE UPDATE ON public.work_team_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_work_team_shifts_updated_at();

ALTER TABLE public.work_team_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_team_shifts_select_policy
  ON public.work_team_shifts
  FOR SELECT
  USING (true);

CREATE POLICY work_team_shifts_insert_policy
  ON public.work_team_shifts
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

CREATE POLICY work_team_shifts_update_policy
  ON public.work_team_shifts
  FOR UPDATE
  USING (true)
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

COMMENT ON TABLE public.work_team_shifts IS 'Operational shifts for field work teams (jornada operativa).';
COMMENT ON COLUMN public.work_team_shifts.work_team_id IS 'Assigned field crew / work team.';
COMMENT ON COLUMN public.work_team_shifts.status IS 'NOT_STARTED is API-only; persisted rows use ACTIVE or FINISHED.';
