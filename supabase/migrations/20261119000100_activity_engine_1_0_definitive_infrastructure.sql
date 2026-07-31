-- Activity Engine 1.0 — definitive event infrastructure.
-- Additive migration: preserves historical rows and legacy writers.
-- No module instrumentation, UI, reports, hooks, or new triggers.

-- ---------------------------------------------------------------------------
-- 1) Canonical columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS app_user_id uuid NULL
    REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text NULL,
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Existing events predate the canonical UI title. Preserve them without
-- inventing or duplicating entity/person names.
UPDATE public.activity_events
SET title = coalesce(
  nullif(trim(metadata ->> 'title'), ''),
  action
)
WHERE title IS NULL;

ALTER TABLE public.activity_events
  ALTER COLUMN title SET DEFAULT 'Actividad registrada',
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS activity_events_title_not_blank;

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_title_not_blank
  CHECK (char_length(trim(title)) > 0);

COMMENT ON COLUMN public.activity_events.app_user_id IS
  'Supabase Auth actor ID. Names are resolved at query time and are never copied into Activity.';

COMMENT ON COLUMN public.activity_events.action IS
  'Stable machine identifier (for example customer.created). Not free UI text.';

COMMENT ON COLUMN public.activity_events.title IS
  'Short UI-ready event title. Must not contain duplicated entity or actor names.';

COMMENT ON COLUMN public.activity_events.description IS
  'Optional human-readable event description.';

COMMENT ON COLUMN public.activity_events.metadata IS
  'Unstructured JSON object. No application-specific schema is enforced.';

-- ---------------------------------------------------------------------------
-- 2) Required lookup indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS activity_events_company_id_idx
  ON public.activity_events (company_id);

CREATE INDEX IF NOT EXISTS activity_events_employee_id_idx
  ON public.activity_events (employee_id);

CREATE INDEX IF NOT EXISTS activity_events_module_idx
  ON public.activity_events (module);

CREATE INDEX IF NOT EXISTS activity_events_entity_type_idx
  ON public.activity_events (entity_type);

CREATE INDEX IF NOT EXISTS activity_events_entity_id_idx
  ON public.activity_events (entity_id);

CREATE INDEX IF NOT EXISTS activity_events_action_idx
  ON public.activity_events (action);

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON public.activity_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Multi-tenant RLS (same company resolver used by the rest of the system)
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_events_select_policy ON public.activity_events;

CREATE POLICY activity_events_select_policy
  ON public.activity_events
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

GRANT SELECT ON TABLE public.activity_events TO authenticated;
GRANT ALL ON TABLE public.activity_events TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Single secure persistence operation for recordActivity()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_activity(
  p_company_id uuid,
  p_employee_id uuid,
  p_app_user_id uuid,
  p_module text,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_title text,
  p_description text,
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
    RAISE EXCEPTION 'ACTIVITY_COMPANY_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'company_id es obligatorio.';
  END IF;

  IF p_module IS NULL OR char_length(trim(p_module)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_MODULE_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'module es obligatorio.';
  END IF;

  IF p_entity_type IS NULL OR char_length(trim(p_entity_type)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_ENTITY_TYPE_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'entity_type es obligatorio.';
  END IF;

  IF p_action IS NULL
    OR trim(p_action) !~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
  THEN
    RAISE EXCEPTION 'ACTIVITY_ACTION_INVALID'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'action debe ser un identificador estable con formato modulo.accion.';
  END IF;

  IF p_title IS NULL OR char_length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'ACTIVITY_TITLE_REQUIRED'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'title es obligatorio.';
  END IF;

  IF p_app_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.app_user_id = p_app_user_id
      AND e.company_id = p_company_id
      AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ACTIVITY_APP_USER_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'app_user_id no pertenece a company_id.';
  END IF;

  v_actor_type := CASE
    WHEN p_employee_id IS NOT NULL THEN 'employee'
    WHEN p_app_user_id IS NOT NULL THEN 'user'
    ELSE 'system'
  END;

  INSERT INTO public.activity_events (
    company_id,
    employee_id,
    app_user_id,
    actor_type,
    module,
    entity_type,
    entity_id,
    action,
    title,
    description,
    detail,
    metadata,
    origin,
    severity
  )
  VALUES (
    p_company_id,
    p_employee_id,
    p_app_user_id,
    v_actor_type,
    trim(p_module),
    trim(p_entity_type),
    p_entity_id,
    trim(p_action),
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    '',
    coalesce(p_metadata, '{}'::jsonb),
    'api',
    'INFO'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_activity(
  uuid, uuid, uuid, text, text, uuid, text, text, text, jsonb
) IS
  'Canonical Activity Engine insert. Called only by the server-side recordActivity() service.';

REVOKE ALL ON FUNCTION public.record_activity(
  uuid, uuid, uuid, text, text, uuid, text, text, text, jsonb
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.record_activity(
  uuid, uuid, uuid, text, text, uuid, text, text, text, jsonb
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.record_activity(
  uuid, uuid, uuid, text, text, uuid, text, text, text, jsonb
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.record_activity(
  uuid, uuid, uuid, text, text, uuid, text, text, text, jsonb
) TO service_role;

NOTIFY pgrst, 'reload schema';
