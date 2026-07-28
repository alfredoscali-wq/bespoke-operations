-- Presence Engine Backend 1.0 — task presence events + operational radius settings.
-- High-volume event log; writes via service_role / admin client. No UI in this sprint.

CREATE TABLE IF NOT EXISTS public.presence_engine_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  operational_radius_meters integer NOT NULL DEFAULT 150
    CONSTRAINT presence_engine_settings_radius_positive
      CHECK (operational_radius_meters > 0 AND operational_radius_meters <= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.presence_engine_settings IS
  'Presence Engine 1.0 — per-company operational geofence radius (server authority).';

COMMENT ON COLUMN public.presence_engine_settings.operational_radius_meters IS
  'Operational presence radius in meters. Default 150. Single source of truth for geofence validation.';

CREATE TABLE IF NOT EXISTS public.task_presence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  provider text NOT NULL,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_presence_events_event_type_check CHECK (
    event_type IN ('ENTER_RADIUS', 'HEARTBEAT', 'EXIT_RADIUS')
  ),
  CONSTRAINT task_presence_events_provider_check CHECK (
    provider IN ('GPS', 'NETWORK', 'FUSED')
  ),
  CONSTRAINT task_presence_events_latitude_check CHECK (
    latitude >= -90 AND latitude <= 90
  ),
  CONSTRAINT task_presence_events_longitude_check CHECK (
    longitude >= -180 AND longitude <= 180
  )
);

COMMENT ON TABLE public.task_presence_events IS
  'Presence Engine 1.0 — field-agent presence events from Bespoke Mobile (ENTER/HEARTBEAT/EXIT).';

-- Exact offline-retry idempotency (same payload replay).
CREATE UNIQUE INDEX IF NOT EXISTS task_presence_events_idempotency_uidx
  ON public.task_presence_events (
    company_id,
    task_id,
    employee_id,
    event_type,
    created_at,
    device_id
  );

-- Volume-oriented lookup indexes (sprint requirements + company scoping).
CREATE INDEX IF NOT EXISTS task_presence_events_task_created_at_idx
  ON public.task_presence_events (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_presence_events_employee_created_at_idx
  ON public.task_presence_events (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_presence_events_created_at_idx
  ON public.task_presence_events (created_at DESC);

CREATE INDEX IF NOT EXISTS task_presence_events_company_task_created_at_idx
  ON public.task_presence_events (company_id, task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_presence_events_company_employee_created_at_idx
  ON public.task_presence_events (company_id, employee_id, created_at DESC);

-- Near-duplicate detection support (task + employee + type + time window).
CREATE INDEX IF NOT EXISTS task_presence_events_dedupe_lookup_idx
  ON public.task_presence_events (
    company_id,
    task_id,
    employee_id,
    event_type,
    created_at DESC
  );

ALTER TABLE public.presence_engine_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_presence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presence_engine_settings_select_policy ON public.presence_engine_settings;
CREATE POLICY presence_engine_settings_select_policy
  ON public.presence_engine_settings
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS task_presence_events_select_policy ON public.task_presence_events;
CREATE POLICY task_presence_events_select_policy
  ON public.task_presence_events
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

-- No authenticated INSERT/UPDATE/DELETE: mobile writes use service_role admin client.
