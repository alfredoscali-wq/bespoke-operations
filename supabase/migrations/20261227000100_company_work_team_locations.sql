-- GPS Live 1.0 — last known crew position during an active shift.
-- One row per company + work team. Heartbeats UPSERT; no history.

UPDATE public.company_mobile_settings
SET gps_heartbeat_interval_seconds = GREATEST(
  30,
  LEAST(120, gps_heartbeat_interval_seconds)
)
WHERE gps_heartbeat_interval_seconds < 30
   OR gps_heartbeat_interval_seconds > 120;

ALTER TABLE public.company_mobile_settings
  DROP CONSTRAINT IF EXISTS company_mobile_settings_heartbeat_interval_positive;

ALTER TABLE public.company_mobile_settings
  ADD CONSTRAINT company_mobile_settings_heartbeat_interval_positive
  CHECK (
    gps_heartbeat_interval_seconds >= 30
    AND gps_heartbeat_interval_seconds <= 120
  );

COMMENT ON COLUMN public.company_mobile_settings.gps_heartbeat_enabled IS
  'When true, Mobile should send GPS Live heartbeats during an ACTIVE shift. Default true.';

COMMENT ON COLUMN public.company_mobile_settings.gps_heartbeat_interval_seconds IS
  'GPS Live heartbeat interval in seconds. Default 60. Allowed range 30–120.';

CREATE TABLE IF NOT EXISTS public.company_work_team_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  work_team_id uuid NOT NULL REFERENCES public.crews (id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.mobile_devices (id) ON DELETE RESTRICT,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_meters double precision,
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_work_team_locations_company_work_team_uidx
    UNIQUE (company_id, work_team_id),
  CONSTRAINT company_work_team_locations_latitude_check
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT company_work_team_locations_longitude_check
    CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT company_work_team_locations_accuracy_check
    CHECK (
      accuracy_meters IS NULL
      OR (accuracy_meters >= 0 AND accuracy_meters <= 10000)
    )
);

COMMENT ON TABLE public.company_work_team_locations IS
  'GPS Live 1.0 — last known position per crew. One row per company + work team. No history.';

COMMENT ON COLUMN public.company_work_team_locations.device_id IS
  'mobile_devices.id that sent the last accepted heartbeat.';

COMMENT ON COLUMN public.company_work_team_locations.captured_at IS
  'Device GPS timestamp from Mobile heartbeat payload.';

COMMENT ON COLUMN public.company_work_team_locations.received_at IS
  'Server receipt time. Authority for freshness and anti-spam.';

CREATE INDEX IF NOT EXISTS company_work_team_locations_company_id_idx
  ON public.company_work_team_locations (company_id);

CREATE INDEX IF NOT EXISTS company_work_team_locations_received_at_idx
  ON public.company_work_team_locations (company_id, received_at DESC);

CREATE OR REPLACE FUNCTION public.set_company_work_team_locations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_company_work_team_locations_updated_at() IS
  'Maintains company_work_team_locations.updated_at on write.';

REVOKE ALL ON FUNCTION public.set_company_work_team_locations_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_company_work_team_locations_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_company_work_team_locations_updated_at() FROM authenticated;

DROP TRIGGER IF EXISTS company_work_team_locations_set_updated_at
  ON public.company_work_team_locations;
CREATE TRIGGER company_work_team_locations_set_updated_at
  BEFORE INSERT OR UPDATE ON public.company_work_team_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_work_team_locations_updated_at();

ALTER TABLE public.company_work_team_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_work_team_locations_select_policy
  ON public.company_work_team_locations;
CREATE POLICY company_work_team_locations_select_policy
  ON public.company_work_team_locations
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

GRANT SELECT ON TABLE public.company_work_team_locations TO authenticated;
GRANT ALL ON TABLE public.company_work_team_locations TO service_role;

-- No authenticated INSERT/UPDATE/DELETE. Mobile writes use service_role
-- after resolving company_id + work_team_id from the authenticated session.
