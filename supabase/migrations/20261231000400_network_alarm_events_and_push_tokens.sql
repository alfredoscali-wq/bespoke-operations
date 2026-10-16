-- Alarmas 1.1 — immutable alarm event log + push token persistence.
-- Does not send notifications, does not add Firebase/FCM, and does not
-- alter Monitoring, Topology, network_devices or network_alarms columns.

CREATE TABLE public.network_alarm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  alarm_id uuid NOT NULL REFERENCES public.network_alarms (id),
  event_type text NOT NULL
    CHECK (event_type IN ('created', 'seen', 'acknowledged', 'resolved')),
  -- Session actor, same semantics as network_alarms.acknowledged_by:
  -- employees.id when the operator has an employee, otherwise auth user id.
  -- No FK: the value may be either identifier, matching existing alarm actors.
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE INDEX network_alarm_events_company_alarm_created_idx
  ON public.network_alarm_events (company_id, alarm_id, created_at);

CREATE INDEX network_alarm_events_alarm_created_idx
  ON public.network_alarm_events (alarm_id, created_at);

CREATE INDEX network_alarm_events_company_type_created_idx
  ON public.network_alarm_events (company_id, event_type, created_at);

COMMENT ON TABLE public.network_alarm_events IS
  'Immutable alarm action log. Insert-only; events are never updated or physically deleted.';

COMMENT ON COLUMN public.network_alarm_events.user_id IS
  'Operator who performed the action. NULL for automatic created/resolved events. Not a FK.';

CREATE OR REPLACE FUNCTION public.enforce_network_alarm_events_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_alarm public.network_alarms%ROWTYPE;
BEGIN
  SELECT *
    INTO v_alarm
  FROM public.network_alarms
  WHERE id = NEW.alarm_id;

  IF v_alarm.id IS NULL THEN
    RAISE EXCEPTION 'El evento requiere una alarma existente.';
  END IF;

  IF v_alarm.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El evento no puede asociarse a una alarma de otra empresa.';
  END IF;

  NEW.company_id := v_alarm.company_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_alarm_events_enforce_tenant
  BEFORE INSERT ON public.network_alarm_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_alarm_events_tenant();

CREATE OR REPLACE FUNCTION public.reject_network_alarm_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos de alarma son inmutables.';
END;
$$;

CREATE TRIGGER network_alarm_events_reject_mutation
  BEFORE UPDATE OR DELETE ON public.network_alarm_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_network_alarm_event_mutation();

ALTER TABLE public.network_alarm_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_alarm_events_select_policy
  ON public.network_alarm_events
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_alarm_events_insert_policy
  ON public.network_alarm_events
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT ON public.network_alarm_events TO authenticated;

-- Push token persistence only. No FCM, no send, no register endpoint in 1.1.
CREATE TABLE public.network_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  user_id uuid NOT NULL REFERENCES public.employees (id),
  -- Mobile hardware/app identifier (mobile_devices.device_id), NOT network_devices.id
  -- and not mobile_devices.id. Kept as text without FK until the Mobile/FCM contract.
  device_id text NOT NULL
    CHECK (char_length(btrim(device_id)) > 0),
  platform text NOT NULL
    CHECK (platform IN ('android')),
  push_token text NOT NULL
    CHECK (char_length(btrim(push_token)) > 0),
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX network_push_tokens_user_device_idx
  ON public.network_push_tokens (company_id, user_id, device_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX network_push_tokens_token_idx
  ON public.network_push_tokens (company_id, push_token)
  WHERE deleted_at IS NULL;

CREATE INDEX network_push_tokens_company_user_idx
  ON public.network_push_tokens (company_id, user_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_push_tokens IS
  'Future FCM registration store. Alarmas 1.1 persists the schema only; no send, no Firebase, no register API. Never return push_token from alarm or NOC APIs.';

COMMENT ON COLUMN public.network_push_tokens.device_id IS
  'External Mobile device identifier (mobile_devices.device_id). Not a FK to network_devices or mobile_devices.';

COMMENT ON COLUMN public.network_push_tokens.push_token IS
  'Opaque device push token. Must not be logged or included in alarm/NOC responses.';

CREATE TRIGGER network_push_tokens_set_updated_at
  BEFORE UPDATE ON public.network_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_network_push_tokens_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
BEGIN
  SELECT *
    INTO v_employee
  FROM public.employees
  WHERE id = NEW.user_id
    AND deleted_at IS NULL;

  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'El token Push requiere un empleado existente.';
  END IF;

  IF v_employee.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El token Push no puede asociarse a un usuario de otra empresa.';
  END IF;

  NEW.company_id := v_employee.company_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_push_tokens_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_push_tokens_tenant();

ALTER TABLE public.network_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_push_tokens_select_policy
  ON public.network_push_tokens
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_push_tokens_insert_policy
  ON public.network_push_tokens
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_push_tokens_update_policy
  ON public.network_push_tokens
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.network_push_tokens TO authenticated;
