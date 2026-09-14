-- Bespoke Mobile — per-company operational settings (shift/OT GPS + heartbeat).
-- 1:1 with companies. No backfill. Defaults are configuration only:
-- they do not change current shift-service or task-start GPS behavior.

CREATE TABLE IF NOT EXISTS public.company_mobile_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  shift_location_validation_enabled boolean NOT NULL DEFAULT false,
  shift_radius_meters integer NOT NULL DEFAULT 150,
  task_location_validation_enabled boolean NOT NULL DEFAULT false,
  task_radius_meters integer NOT NULL DEFAULT 150,
  gps_heartbeat_enabled boolean NOT NULL DEFAULT true,
  gps_heartbeat_interval_seconds integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_mobile_settings_shift_radius_positive
    CHECK (shift_radius_meters > 0 AND shift_radius_meters <= 10000),
  CONSTRAINT company_mobile_settings_task_radius_positive
    CHECK (task_radius_meters > 0 AND task_radius_meters <= 10000),
  CONSTRAINT company_mobile_settings_heartbeat_interval_positive
    CHECK (
      gps_heartbeat_interval_seconds > 0
      AND gps_heartbeat_interval_seconds <= 86400
    )
);

COMMENT ON TABLE public.company_mobile_settings IS
  'Bespoke Mobile operational settings per company. Exposed on bootstrap. Does not yet govern shift or task GPS runtime.';

COMMENT ON COLUMN public.company_mobile_settings.shift_location_validation_enabled IS
  'When true, Mobile should enforce GPS radius on jornada start. Default false. Runtime not wired in this sprint.';

COMMENT ON COLUMN public.company_mobile_settings.shift_radius_meters IS
  'Jornada GPS radius in meters. Default 150. Must be > 0.';

COMMENT ON COLUMN public.company_mobile_settings.task_location_validation_enabled IS
  'When true, Mobile should enforce GPS radius on OT start. Default false. Runtime not wired in this sprint.';

COMMENT ON COLUMN public.company_mobile_settings.task_radius_meters IS
  'OT GPS radius in meters. Default 150. Must be > 0.';

COMMENT ON COLUMN public.company_mobile_settings.gps_heartbeat_enabled IS
  'When true, Mobile should send GPS heartbeats. Default true. Runtime not wired in this sprint.';

COMMENT ON COLUMN public.company_mobile_settings.gps_heartbeat_interval_seconds IS
  'GPS heartbeat interval in seconds. Default 60. Must be > 0.';

CREATE OR REPLACE FUNCTION public.set_company_mobile_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_company_mobile_settings_updated_at() IS
  'Maintains company_mobile_settings.updated_at on write.';

REVOKE ALL ON FUNCTION public.set_company_mobile_settings_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_company_mobile_settings_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_company_mobile_settings_updated_at() FROM authenticated;

DROP TRIGGER IF EXISTS company_mobile_settings_set_updated_at ON public.company_mobile_settings;
CREATE TRIGGER company_mobile_settings_set_updated_at
  BEFORE INSERT OR UPDATE ON public.company_mobile_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_mobile_settings_updated_at();

ALTER TABLE public.company_mobile_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_mobile_settings_select_policy ON public.company_mobile_settings;
CREATE POLICY company_mobile_settings_select_policy
  ON public.company_mobile_settings
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

GRANT SELECT ON TABLE public.company_mobile_settings TO authenticated;

-- No authenticated INSERT/UPDATE/DELETE: writes are service_role / future admin UI.
-- Bootstrap uses createAdminClient() and still filters by the company resolved via mobile_code.
