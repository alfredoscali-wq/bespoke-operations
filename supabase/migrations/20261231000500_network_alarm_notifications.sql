-- Alarmas 1.1 — FCM notification delivery audit per employee.
-- Independent from the events / token-registry WIP.
-- Does not store FCM tokens. Does not change Monitoring, Discovery, Topology,
-- recipient selection or the Mobile Alarms catalog.

CREATE TABLE public.network_alarm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  alarm_id uuid NOT NULL REFERENCES public.network_alarms (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  device_id text,
  send_outcome text NOT NULL
    CHECK (send_outcome IN ('sent', 'failed', 'not_attempted')),
  error_code text,
  attempted_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT network_alarm_notifications_sent_consistency
    CHECK (
      (send_outcome = 'sent' AND sent_at IS NOT NULL)
      OR (send_outcome <> 'sent' AND sent_at IS NULL)
    ),
  CONSTRAINT network_alarm_notifications_attempt_consistency
    CHECK (
      (send_outcome = 'not_attempted' AND attempted_at IS NULL)
      OR (send_outcome <> 'not_attempted' AND attempted_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX network_alarm_notifications_alarm_employee_idx
  ON public.network_alarm_notifications (alarm_id, employee_id);

CREATE INDEX network_alarm_notifications_company_alarm_idx
  ON public.network_alarm_notifications (company_id, alarm_id);

CREATE INDEX network_alarm_notifications_company_employee_idx
  ON public.network_alarm_notifications (company_id, employee_id);

COMMENT ON TABLE public.network_alarm_notifications IS
  'Per-employee FCM delivery audit for a network alarm. One row per alarm+employee; multiple devices are aggregated. Never store push tokens.';

COMMENT ON COLUMN public.network_alarm_notifications.device_id IS
  'Optional Mobile hardware id. Not an FCM token and not network_devices.id.';

COMMENT ON COLUMN public.network_alarm_notifications.send_outcome IS
  'sent: at least one device accepted by FCM. failed: every attempt failed. not_attempted: Firebase was not configured.';

COMMENT ON COLUMN public.network_alarm_notifications.opened_at IS
  'First Mobile tap of the notification. Distinct from network_alarms.seen_at.';

CREATE TRIGGER network_alarm_notifications_set_updated_at
  BEFORE UPDATE ON public.network_alarm_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_network_alarm_notifications_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_alarm public.network_alarms%ROWTYPE;
  v_employee public.employees%ROWTYPE;
BEGIN
  SELECT *
    INTO v_alarm
  FROM public.network_alarms
  WHERE id = NEW.alarm_id;

  IF v_alarm.id IS NULL THEN
    RAISE EXCEPTION 'La notificación requiere una alarma existente.';
  END IF;

  IF v_alarm.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La notificación no puede asociarse a una alarma de otra empresa.';
  END IF;

  NEW.company_id := v_alarm.company_id;

  SELECT *
    INTO v_employee
  FROM public.employees
  WHERE id = NEW.employee_id;

  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'La notificación requiere un empleado existente.';
  END IF;

  IF v_employee.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La notificación no puede asociarse a un empleado de otra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER network_alarm_notifications_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_alarm_notifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_alarm_notifications_tenant();

ALTER TABLE public.network_alarm_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_alarm_notifications_select_policy
  ON public.network_alarm_notifications
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

GRANT SELECT ON public.network_alarm_notifications TO authenticated;
