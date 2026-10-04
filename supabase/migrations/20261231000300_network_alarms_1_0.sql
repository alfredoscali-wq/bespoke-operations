-- Network Alarms 1.0 — operational alarm layer on top of monitoring.
-- Does not alter Discovery inventory, network_devices, network_links,
-- network_device_status, network_device_status_events or
-- network_topology_placements.
-- Alarmas 1.0 opens/resolves one independent alarm per managed device.
-- root_alarm_id / is_root are stored for future compatibility and are unused
-- for correlation in 1.0 (new rows: root_alarm_id NULL, is_root TRUE).

CREATE TABLE public.network_alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  device_id uuid NOT NULL REFERENCES public.network_devices (id),
  severity text NOT NULL
    CHECK (severity IN ('critical', 'warning')),
  status text NOT NULL
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title text NOT NULL
    CHECK (char_length(btrim(title)) > 0),
  message text NOT NULL
    CHECK (char_length(btrim(message)) > 0),
  root_alarm_id uuid REFERENCES public.network_alarms (id) ON DELETE SET NULL,
  is_root boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_alarms_root_consistency
    CHECK (
      (is_root AND root_alarm_id IS NULL)
      OR (NOT is_root AND root_alarm_id IS NOT NULL)
    ),
  CONSTRAINT network_alarms_ack_consistency
    CHECK (
      (acknowledged_at IS NULL AND acknowledged_by IS NULL)
      OR (acknowledged_at IS NOT NULL)
    ),
  CONSTRAINT network_alarms_resolve_consistency
    CHECK (
      (status <> 'resolved' AND resolved_at IS NULL AND resolved_by IS NULL)
      OR (status = 'resolved' AND resolved_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX network_alarms_one_active_per_device_idx
  ON public.network_alarms (company_id, device_id)
  WHERE deleted_at IS NULL AND status IN ('open', 'acknowledged');

CREATE INDEX network_alarms_company_status_idx
  ON public.network_alarms (company_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX network_alarms_device_idx
  ON public.network_alarms (company_id, device_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX network_alarms_root_idx
  ON public.network_alarms (root_alarm_id)
  WHERE deleted_at IS NULL AND root_alarm_id IS NOT NULL;

COMMENT ON TABLE public.network_alarms IS
  'Operational NOC alarms derived from monitoring status transitions. Does not replace network_device_status or its event history. Alarmas 1.0 does not correlate parent/child alarms.';

COMMENT ON COLUMN public.network_alarms.root_alarm_id IS
  'Reserved for future correlation. Alarmas 1.0 always stores NULL.';

COMMENT ON COLUMN public.network_alarms.is_root IS
  'Reserved for future correlation. Alarmas 1.0 always stores TRUE.';

CREATE TRIGGER network_alarms_set_updated_at
  BEFORE UPDATE ON public.network_alarms
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_network_alarms_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_device public.network_devices%ROWTYPE;
  v_root public.network_alarms%ROWTYPE;
BEGIN
  SELECT *
    INTO v_device
  FROM public.network_devices
  WHERE id = NEW.device_id
    AND deleted_at IS NULL;

  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'La alarma requiere un dispositivo existente.';
  END IF;

  IF v_device.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La alarma no puede asociarse a un dispositivo de otra empresa.';
  END IF;

  NEW.company_id := v_device.company_id;

  IF NEW.root_alarm_id IS NOT NULL THEN
    IF NEW.root_alarm_id = NEW.id THEN
      RAISE EXCEPTION 'La alarma raíz no puede referenciarse a sí misma.';
    END IF;

    SELECT *
      INTO v_root
    FROM public.network_alarms
    WHERE id = NEW.root_alarm_id
      AND deleted_at IS NULL;

    IF v_root.id IS NULL THEN
      RAISE EXCEPTION 'La alarma dependiente requiere una alarma raíz existente.';
    END IF;

    IF v_root.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'La alarma dependiente no puede asociarse a una raíz de otra empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER network_alarms_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_alarms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_alarms_tenant();

ALTER TABLE public.network_alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_alarms_select_policy
  ON public.network_alarms
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_alarms_insert_policy
  ON public.network_alarms
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_alarms_update_policy
  ON public.network_alarms
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

GRANT SELECT, INSERT, UPDATE ON public.network_alarms TO authenticated;
