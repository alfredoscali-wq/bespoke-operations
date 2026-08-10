-- OBRAS OPS 2.6 — Daily load allocations for multi-day Obra OTs.
-- Source of truth for per-day minutes; empty = even-split fallback.
-- No backfill. Does not modify tasks.estimated_duration.

CREATE TABLE IF NOT EXISTS public.task_daily_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  work_date date NOT NULL,
  allocated_minutes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_daily_allocations_minutes_positive
    CHECK (allocated_minutes > 0),
  CONSTRAINT task_daily_allocations_task_date_unique
    UNIQUE (task_id, work_date)
);

CREATE INDEX IF NOT EXISTS task_daily_allocations_company_task_idx
  ON public.task_daily_allocations (company_id, task_id);

CREATE INDEX IF NOT EXISTS task_daily_allocations_company_date_idx
  ON public.task_daily_allocations (company_id, work_date);

CREATE INDEX IF NOT EXISTS task_daily_allocations_task_date_idx
  ON public.task_daily_allocations (task_id, work_date);

COMMENT ON TABLE public.task_daily_allocations IS
  'OPS 2.6: optional per-day minute allocations for multi-day Obra OTs. Absence = even split of estimated_duration.';

COMMENT ON COLUMN public.task_daily_allocations.allocated_minutes IS
  'Minutes committed on work_date. Must sum to OT total duration when set.';

CREATE OR REPLACE FUNCTION public.set_task_daily_allocations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_daily_allocations_set_updated_at
  ON public.task_daily_allocations;

CREATE TRIGGER task_daily_allocations_set_updated_at
  BEFORE UPDATE ON public.task_daily_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_daily_allocations_updated_at();

ALTER TABLE public.task_daily_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_daily_allocations_select_policy
  ON public.task_daily_allocations;
DROP POLICY IF EXISTS task_daily_allocations_insert_policy
  ON public.task_daily_allocations;
DROP POLICY IF EXISTS task_daily_allocations_update_policy
  ON public.task_daily_allocations;
DROP POLICY IF EXISTS task_daily_allocations_delete_policy
  ON public.task_daily_allocations;

CREATE POLICY task_daily_allocations_select_policy
  ON public.task_daily_allocations
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

CREATE POLICY task_daily_allocations_insert_policy
  ON public.task_daily_allocations
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY task_daily_allocations_update_policy
  ON public.task_daily_allocations
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY task_daily_allocations_delete_policy
  ON public.task_daily_allocations
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

REVOKE ALL ON TABLE public.task_daily_allocations FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_daily_allocations
  TO authenticated;
GRANT ALL ON TABLE public.task_daily_allocations TO service_role;
