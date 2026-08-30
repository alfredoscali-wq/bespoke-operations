-- Network 3.2-A — Historical status transitions for managed devices.
-- Does not alter network_device_status (current state) or Discovery inventory.
-- Does not create triggers that insert events. Writes happen server-side later.

CREATE TABLE public.network_device_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  device_id uuid NOT NULL REFERENCES public.network_devices (id),
  previous_status text NOT NULL
    CHECK (previous_status IN ('unknown', 'online', 'offline', 'degraded')),
  new_status text NOT NULL
    CHECK (new_status IN ('unknown', 'online', 'offline', 'degraded')),
  changed_at timestamptz NOT NULL,
  job_id uuid REFERENCES public.network_agent_jobs (id),
  consecutive_failures integer
    CHECK (consecutive_failures IS NULL OR consecutive_failures >= 0),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX network_device_status_events_device_changed_idx
  ON public.network_device_status_events (device_id, changed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX network_device_status_events_company_changed_idx
  ON public.network_device_status_events (company_id, changed_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.network_device_status_events IS
  'Historical transitions of network_device_status. Not a poll log. Current state remains in network_device_status.';

CREATE OR REPLACE FUNCTION public.enforce_network_device_status_events_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_device public.network_devices%ROWTYPE;
  v_job public.network_agent_jobs%ROWTYPE;
BEGIN
  SELECT *
    INTO v_device
  FROM public.network_devices
  WHERE id = NEW.device_id
    AND deleted_at IS NULL;

  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'El histórico de estado requiere un dispositivo existente.';
  END IF;

  IF v_device.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El histórico de estado no puede asociarse a un dispositivo de otra empresa.';
  END IF;

  NEW.company_id := v_device.company_id;

  IF NEW.job_id IS NOT NULL THEN
    SELECT *
      INTO v_job
    FROM public.network_agent_jobs
    WHERE id = NEW.job_id
      AND deleted_at IS NULL;

    IF v_job.id IS NULL THEN
      RAISE EXCEPTION 'El histórico de estado requiere un job existente.';
    END IF;

    IF v_job.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El histórico de estado no puede asociarse a un job de otra empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER network_device_status_events_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_device_status_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_device_status_events_tenant();

ALTER TABLE public.network_device_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_device_status_events_select_policy
  ON public.network_device_status_events
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

GRANT SELECT ON public.network_device_status_events TO authenticated;
