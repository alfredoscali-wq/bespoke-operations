-- Activity Engine 1.0 — infrastructure (Fase 3)
-- Cross-cutting activity_events. Does NOT replace system_audit_log,
-- customer_atencion_events, task_operational_events, project_history, etc.

CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  employee_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  module text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  action text NOT NULL,
  detail text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origin text NOT NULL,
  correlation_id uuid NULL,
  severity text NOT NULL DEFAULT 'INFO',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_events_actor_type_check
    CHECK (actor_type IN ('user', 'employee', 'system', 'service')),
  CONSTRAINT activity_events_origin_check
    CHECK (origin IN ('web', 'mobile', 'api', 'cron', 'system')),
  CONSTRAINT activity_events_severity_check
    CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  CONSTRAINT activity_events_module_not_blank
    CHECK (char_length(trim(module)) > 0),
  CONSTRAINT activity_events_entity_type_not_blank
    CHECK (char_length(trim(entity_type)) > 0),
  CONSTRAINT activity_events_action_not_blank
    CHECK (char_length(trim(action)) > 0)
);

COMMENT ON TABLE public.activity_events IS
  'Activity Engine 1.0 — append-only cross-module business activity. Complements domain timelines and system_audit_log.';

COMMENT ON COLUMN public.activity_events.actor_type IS
  'Actor classification: user | employee | system | service.';

COMMENT ON COLUMN public.activity_events.origin IS
  'Write origin: web | mobile | api | cron | system.';

COMMENT ON COLUMN public.activity_events.correlation_id IS
  'Optional link to a domain event or request (e.g. customer_atencion_events.id).';

COMMENT ON COLUMN public.activity_events.action IS
  'Official Activity catalog code (validated in application layer).';

-- Indexes (lookup + reporting)
CREATE INDEX IF NOT EXISTS activity_events_company_created_idx
  ON public.activity_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_company_module_created_idx
  ON public.activity_events (company_id, module, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_company_action_created_idx
  ON public.activity_events (company_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_company_employee_created_idx
  ON public.activity_events (company_id, employee_id, created_at DESC)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_events_entity_created_idx
  ON public.activity_events (company_id, entity_type, entity_id, created_at DESC)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_events_correlation_id_idx
  ON public.activity_events (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_events_metadata_gin_idx
  ON public.activity_events USING gin (metadata);

-- Tenant integrity: employee must belong to same company when present
CREATE OR REPLACE FUNCTION public.enforce_activity_events_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = NEW.employee_id
        AND e.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'ACTIVITY_EVENT_EMPLOYEE_TENANT_MISMATCH'
        USING ERRCODE = 'check_violation',
              MESSAGE = 'El empleado del evento no pertenece al tenant indicado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_events_enforce_tenant_integrity
  ON public.activity_events;

CREATE TRIGGER activity_events_enforce_tenant_integrity
  BEFORE INSERT ON public.activity_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_activity_events_tenant_integrity();

-- RLS: SELECT for own company; no arbitrary client INSERT/UPDATE/DELETE
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_events_select_policy ON public.activity_events;
CREATE POLICY activity_events_select_policy
  ON public.activity_events
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

-- Intentionally no INSERT/UPDATE/DELETE policies for authenticated.
-- Writes go through service_role or SECURITY DEFINER RPC below.

GRANT SELECT ON TABLE public.activity_events TO authenticated;
GRANT ALL ON TABLE public.activity_events TO service_role;

-- Secure write path (service_role only)
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
  p_severity text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
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
    severity
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
    coalesce(nullif(trim(coalesce(p_severity, '')), ''), 'INFO')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_activity_event IS
  'Activity Engine 1.0 — secure insert into activity_events (service_role).';

REVOKE ALL ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, uuid, text
) TO service_role;

NOTIFY pgrst, 'reload schema';
