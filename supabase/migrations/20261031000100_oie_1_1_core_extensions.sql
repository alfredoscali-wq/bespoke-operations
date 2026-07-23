-- OIE 1.1 — Operational Intelligence Engine core extensions (additive).
-- Extends Activity Engine 1.0 store (activity_events). Does NOT create a second engine.
-- All new columns are NULL-compatible with existing rows and callers.
-- Architecture: OIE 1.0 + OIE 1.0A.

-- ---------------------------------------------------------------------------
-- 1) Additive columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS result text NULL;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS session_id uuid NULL;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS duration_ms bigint NULL;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS latitude double precision NULL;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS longitude double precision NULL;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS accuracy_m real NULL;

COMMENT ON COLUMN public.activity_events.result IS
  'OIE 1.1 — structured outcome code (catalog). Independent from action. NULL when N/A.';

COMMENT ON COLUMN public.activity_events.session_id IS
  'OIE 1.1 — operational session id (shift, sales route, on-call). May equal a domain id (e.g. work_team_shifts.id).';

COMMENT ON COLUMN public.activity_events.duration_ms IS
  'OIE 1.1 — duration in milliseconds on completion/close events. NULL otherwise.';

COMMENT ON COLUMN public.activity_events.latitude IS
  'OIE 1.1 — WGS84 latitude when the fact is spatially meaningful (field).';

COMMENT ON COLUMN public.activity_events.longitude IS
  'OIE 1.1 — WGS84 longitude when the fact is spatially meaningful (field).';

COMMENT ON COLUMN public.activity_events.accuracy_m IS
  'OIE 1.1 — GPS accuracy in meters (device). NULL when unknown.';

COMMENT ON TABLE public.activity_events IS
  'OIE / Activity Engine — append-only cross-module operational facts. Complements domain timelines and system_audit_log.';

-- Geo: both coordinates present or both absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_events_geo_pair_check'
      AND conrelid = 'public.activity_events'::regclass
  ) THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_geo_pair_check
      CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_events_latitude_range_check'
      AND conrelid = 'public.activity_events'::regclass
  ) THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_latitude_range_check
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_events_longitude_range_check'
      AND conrelid = 'public.activity_events'::regclass
  ) THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_longitude_range_check
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_events_accuracy_m_check'
      AND conrelid = 'public.activity_events'::regclass
  ) THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_accuracy_m_check
      CHECK (accuracy_m IS NULL OR accuracy_m >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_events_duration_ms_check'
      AND conrelid = 'public.activity_events'::regclass
  ) THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_duration_ms_check
      CHECK (duration_ms IS NULL OR duration_ms >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_events_result_not_blank'
      AND conrelid = 'public.activity_events'::regclass
  ) THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_result_not_blank
      CHECK (result IS NULL OR char_length(trim(result)) > 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Indexes (partial — only when values present)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS activity_events_company_action_result_created_idx
  ON public.activity_events (company_id, action, result, created_at DESC)
  WHERE result IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_events_company_session_created_idx
  ON public.activity_events (company_id, session_id, created_at ASC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_events_company_geo_created_idx
  ON public.activity_events (company_id, created_at DESC)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) RPC — extend record_activity_event (drop prior signature, recreate)
--    New params DEFAULT NULL → existing named-arg callers remain valid.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text
);

CREATE OR REPLACE FUNCTION public.record_activity_event(
  p_company_id uuid,
  p_employee_id uuid,
  p_actor_type text,
  p_module text,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_detail text,
  p_metadata jsonb,
  p_origin text,
  p_correlation_id uuid,
  p_severity text,
  p_result text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_duration_ms bigint DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy_m real DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_result text;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_COMPANY_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'company_id es obligatorio.';
  END IF;

  IF p_action IS NULL OR char_length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_ACTION_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'action es obligatorio.';
  END IF;

  IF p_module IS NULL OR char_length(trim(p_module)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_MODULE_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'module es obligatorio.';
  END IF;

  IF p_entity_type IS NULL OR char_length(trim(p_entity_type)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_ENTITY_TYPE_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'entity_type es obligatorio.';
  END IF;

  IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_GEO_PAIR_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'latitude y longitude deben enviarse juntos o ambos omitirse.';
  END IF;

  IF p_latitude IS NOT NULL AND (p_latitude < -90 OR p_latitude > 90) THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_LATITUDE_RANGE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'latitude fuera de rango (-90..90).';
  END IF;

  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_LONGITUDE_RANGE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'longitude fuera de rango (-180..180).';
  END IF;

  IF p_accuracy_m IS NOT NULL AND p_accuracy_m < 0 THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_ACCURACY_INVALID'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'accuracy_m no puede ser negativo.';
  END IF;

  IF p_duration_ms IS NOT NULL AND p_duration_ms < 0 THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_DURATION_INVALID'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'duration_ms no puede ser negativo.';
  END IF;

  v_result := nullif(trim(coalesce(p_result, '')), '');

  INSERT INTO public.activity_events (
    company_id,
    employee_id,
    actor_type,
    module,
    entity_type,
    entity_id,
    action,
    detail,
    metadata,
    origin,
    correlation_id,
    severity,
    result,
    session_id,
    duration_ms,
    latitude,
    longitude,
    accuracy_m
  )
  VALUES (
    p_company_id,
    p_employee_id,
    trim(p_actor_type),
    trim(p_module),
    trim(p_entity_type),
    p_entity_id,
    trim(p_action),
    coalesce(nullif(trim(coalesce(p_detail, '')), ''), ''),
    coalesce(p_metadata, '{}'::jsonb),
    trim(p_origin),
    p_correlation_id,
    coalesce(nullif(trim(coalesce(p_severity, '')), ''), 'INFO'),
    v_result,
    p_session_id,
    p_duration_ms,
    p_latitude,
    p_longitude,
    p_accuracy_m
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_activity_event IS
  'OIE 1.1 / Activity Engine — secure insert into activity_events (service_role). Optional result, session, duration, geo.';

REVOKE ALL ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text,
  text, uuid, bigint, double precision, double precision, real
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text,
  text, uuid, bigint, double precision, double precision, real
) TO service_role;

-- RLS unchanged: SELECT by company_id for authenticated; writes via this RPC / service_role only.

NOTIFY pgrst, 'reload schema';
