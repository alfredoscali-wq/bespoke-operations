-- Activity Engine 1.1A — Foundation (additive).
-- Extends existing public.activity_events (Activity Engine 1.0 / OIE).
-- Does NOT replace domain timelines (e.g. customer_atencion_events).
-- Does NOT change UI or module integrations.

-- ---------------------------------------------------------------------------
-- 1) Foundation columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS category text NULL;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS impact text NULL;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.activity_events.category IS
  'Activity Engine 1.1A — semantic category (CONTACT, FOLLOW_UP, …). NULL on legacy 1.0 rows.';

COMMENT ON COLUMN public.activity_events.impact IS
  'Activity Engine 1.1A — impact class (ACTIVITY | PRODUCTION | RESULT). NULL on legacy 1.0 rows.';

COMMENT ON COLUMN public.activity_events.updated_at IS
  'Activity Engine 1.1A — last update timestamp (append-oriented; defaults to created_at).';

-- ---------------------------------------------------------------------------
-- 2) Origin check: keep legacy values + 1.1A origins
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS activity_events_origin_check;

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_origin_check
  CHECK (
    origin IN (
      'web',
      'mobile',
      'api',
      'cron',
      'system',
      'USER',
      'SYSTEM',
      'AUTOMATION',
      'INTEGRATION'
    )
  );

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS activity_events_category_check;

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_category_check
  CHECK (
    category IS NULL
    OR category IN (
      'CONTACT',
      'FOLLOW_UP',
      'TECHNICAL',
      'ADMINISTRATIVE',
      'SALES',
      'OPERATIONAL',
      'SYSTEM',
      'COMMUNICATION'
    )
  );

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS activity_events_impact_check;

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_impact_check
  CHECK (
    impact IS NULL
    OR impact IN ('ACTIVITY', 'PRODUCTION', 'RESULT')
  );

-- ---------------------------------------------------------------------------
-- 3) updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_activity_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_events_set_updated_at ON public.activity_events;

CREATE TRIGGER activity_events_set_updated_at
  BEFORE UPDATE ON public.activity_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_activity_events_updated_at();

-- ---------------------------------------------------------------------------
-- 4) Indexes (1.1A minimum set; IF NOT EXISTS for coexistence)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS activity_events_company_id_idx
  ON public.activity_events (company_id);

CREATE INDEX IF NOT EXISTS activity_events_module_idx
  ON public.activity_events (module);

CREATE INDEX IF NOT EXISTS activity_events_employee_id_idx
  ON public.activity_events (employee_id);

CREATE INDEX IF NOT EXISTS activity_events_entity_type_idx
  ON public.activity_events (entity_type);

CREATE INDEX IF NOT EXISTS activity_events_entity_id_idx
  ON public.activity_events (entity_id);

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON public.activity_events (created_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_company_category_created_idx
  ON public.activity_events (company_id, category, created_at DESC)
  WHERE category IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) RLS remains multi-tenant SELECT for authenticated; writes via RPC.
--    (Policies already created in Activity Engine 1.0 — reaffirm SELECT.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_events_select_policy ON public.activity_events;
CREATE POLICY activity_events_select_policy
  ON public.activity_events
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

-- ---------------------------------------------------------------------------
-- 6) Secure write RPC for Activity Engine 1.1A public API
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_activity_engine_event(
  p_company_id uuid,
  p_module text,
  p_entity_type text,
  p_entity_id uuid,
  p_employee_id uuid,
  p_action text,
  p_category text,
  p_impact text,
  p_origin text,
  p_metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor_type text;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_COMPANY_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'company_id es obligatorio.';
  END IF;

  IF p_module IS NULL OR char_length(trim(p_module)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_MODULE_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'module es obligatorio.';
  END IF;

  IF p_entity_type IS NULL OR char_length(trim(p_entity_type)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_ENTITY_TYPE_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'entity_type es obligatorio.';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_ENTITY_ID_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'entity_id es obligatorio.';
  END IF;

  IF p_action IS NULL OR char_length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_ACTION_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'action es obligatorio.';
  END IF;

  IF p_category IS NULL OR char_length(trim(p_category)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_CATEGORY_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'category es obligatorio.';
  END IF;

  IF p_impact IS NULL OR char_length(trim(p_impact)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_IMPACT_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'impact es obligatorio.';
  END IF;

  IF p_origin IS NULL OR char_length(trim(p_origin)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_ENGINE_ORIGIN_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'origin es obligatorio.';
  END IF;

  -- Map 1.1A origin → legacy actor_type required by Activity Engine 1.0 rows.
  v_actor_type := CASE trim(p_origin)
    WHEN 'USER' THEN CASE WHEN p_employee_id IS NULL THEN 'user' ELSE 'employee' END
    WHEN 'SYSTEM' THEN 'system'
    WHEN 'AUTOMATION' THEN 'service'
    WHEN 'INTEGRATION' THEN 'service'
    ELSE 'system'
  END;

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
    category,
    impact,
    updated_at
  )
  VALUES (
    p_company_id,
    p_employee_id,
    v_actor_type,
    trim(p_module),
    trim(p_entity_type),
    p_entity_id,
    trim(p_action),
    '',
    coalesce(p_metadata, '{}'::jsonb),
    trim(p_origin),
    NULL,
    'INFO',
    trim(p_category),
    trim(p_impact),
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_activity_engine_event IS
  'Activity Engine 1.1A — secure insert used by activity.record() (service_role).';

REVOKE ALL ON FUNCTION public.record_activity_engine_event(
  uuid, text, text, uuid, uuid, text, text, text, text, jsonb
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.record_activity_engine_event(
  uuid, text, text, uuid, uuid, text, text, text, text, jsonb
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.record_activity_engine_event(
  uuid, text, text, uuid, uuid, text, text, text, text, jsonb
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.record_activity_engine_event(
  uuid, text, text, uuid, uuid, text, text, text, text, jsonb
) TO service_role;

NOTIFY pgrst, 'reload schema';
