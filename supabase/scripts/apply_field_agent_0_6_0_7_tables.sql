-- Bespoke Operations — Field Agent AGENT 0.6 + 0.7 (manual apply)
-- Creates: public.mobile_devices, public.work_team_shifts
-- Safe to re-run (idempotent). Does not modify supabase_migrations history.
--
-- Prerequisites (must already exist):
--   public.companies, public.crews, public.employees
--   public.auth_is_demo_platform_read_only()
--
-- Audit (MOBILE_DEVICE_*, SHIFT_*) is application-layer via system_audit_log;
-- no DB audit triggers are required for these tables.

BEGIN;

-- ---------------------------------------------------------------------------
-- Prerequisites
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.companies';
  END IF;

  IF to_regclass('public.crews') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.crews';
  END IF;

  IF to_regclass('public.employees') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.employees';
  END IF;

  IF to_regprocedure('public.auth_is_demo_platform_read_only()') IS NULL THEN
    RAISE EXCEPTION
      'Missing function public.auth_is_demo_platform_read_only(). '
      'Apply demo platform read-only RLS before running this script.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- AGENT 0.6 — mobile_devices
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'mobile_device_status'
  ) THEN
    CREATE TYPE public.mobile_device_status AS ENUM ('ACTIVE', 'BLOCKED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mobile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  work_team_id uuid REFERENCES public.crews (id) ON DELETE SET NULL,
  device_id text NOT NULL,
  manufacturer text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  android_version text NOT NULL DEFAULT '',
  app_version text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'android',
  status public.mobile_device_status NOT NULL DEFAULT 'ACTIVE',
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_devices_company_device_unique
  ON public.mobile_devices (company_id, device_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS mobile_devices_company_id_idx
  ON public.mobile_devices (company_id);

CREATE INDEX IF NOT EXISTS mobile_devices_status_idx
  ON public.mobile_devices (status);

CREATE INDEX IF NOT EXISTS mobile_devices_deleted_at_idx
  ON public.mobile_devices (deleted_at);

CREATE OR REPLACE FUNCTION public.set_mobile_devices_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mobile_devices_set_updated_at ON public.mobile_devices;
CREATE TRIGGER mobile_devices_set_updated_at
  BEFORE UPDATE ON public.mobile_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mobile_devices_updated_at();

ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_devices_select_policy ON public.mobile_devices;
CREATE POLICY mobile_devices_select_policy
  ON public.mobile_devices
  FOR SELECT
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS mobile_devices_insert_policy ON public.mobile_devices;
CREATE POLICY mobile_devices_insert_policy
  ON public.mobile_devices
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS mobile_devices_update_policy ON public.mobile_devices;
CREATE POLICY mobile_devices_update_policy
  ON public.mobile_devices
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

COMMENT ON TABLE public.mobile_devices IS
  'Registered corporate mobile devices for Bespoke Field Agent.';
COMMENT ON COLUMN public.mobile_devices.device_id IS
  'Stable client-generated device identifier.';
COMMENT ON COLUMN public.mobile_devices.work_team_id IS
  'Optional assigned field crew / work team.';

-- ---------------------------------------------------------------------------
-- AGENT 0.7 — work_team_shifts
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'work_team_shift_status'
  ) THEN
    CREATE TYPE public.work_team_shift_status AS ENUM (
      'NOT_STARTED',
      'ACTIVE',
      'FINISHED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.work_team_shifts (
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

CREATE UNIQUE INDEX IF NOT EXISTS work_team_shifts_one_active_per_team
  ON public.work_team_shifts (company_id, work_team_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS work_team_shifts_company_id_idx
  ON public.work_team_shifts (company_id);

CREATE INDEX IF NOT EXISTS work_team_shifts_work_team_id_idx
  ON public.work_team_shifts (work_team_id);

CREATE INDEX IF NOT EXISTS work_team_shifts_mobile_device_id_idx
  ON public.work_team_shifts (mobile_device_id);

CREATE INDEX IF NOT EXISTS work_team_shifts_status_idx
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

DROP TRIGGER IF EXISTS work_team_shifts_set_updated_at ON public.work_team_shifts;
CREATE TRIGGER work_team_shifts_set_updated_at
  BEFORE UPDATE ON public.work_team_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_work_team_shifts_updated_at();

ALTER TABLE public.work_team_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_team_shifts_select_policy ON public.work_team_shifts;
CREATE POLICY work_team_shifts_select_policy
  ON public.work_team_shifts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS work_team_shifts_insert_policy ON public.work_team_shifts;
CREATE POLICY work_team_shifts_insert_policy
  ON public.work_team_shifts
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

DROP POLICY IF EXISTS work_team_shifts_update_policy ON public.work_team_shifts;
CREATE POLICY work_team_shifts_update_policy
  ON public.work_team_shifts
  FOR UPDATE
  USING (true)
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

COMMENT ON TABLE public.work_team_shifts IS
  'Operational shifts for field work teams (jornada operativa).';
COMMENT ON COLUMN public.work_team_shifts.work_team_id IS
  'Assigned field crew / work team.';
COMMENT ON COLUMN public.work_team_shifts.status IS
  'NOT_STARTED is API-only; persisted rows use ACTIVE or FINISHED.';

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification (run after COMMIT)
-- ---------------------------------------------------------------------------
-- SELECT tablename
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('mobile_devices', 'work_team_shifts');
