-- Bespoke Operations — AGENT 0.6: corporate mobile device registry
-- Apply via Supabase Dashboard (SQL Editor) or Supabase CLI: supabase db push
-- Requires: companies, crews, auth_is_demo_platform_read_only()

CREATE TYPE public.mobile_device_status AS ENUM ('ACTIVE', 'BLOCKED');

CREATE TABLE public.mobile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  work_team_id uuid REFERENCES public.crews (id) ON DELETE SET NULL,
  device_id text NOT NULL,
  manufacturer text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  android_version text NOT NULL DEFAULT '',
  app_version text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'android',
  status public.mobile_device_status NOT NULL DEFAULT 'ACTIVE',
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX mobile_devices_company_device_unique
  ON public.mobile_devices (company_id, device_id)
  WHERE deleted_at IS NULL;

CREATE INDEX mobile_devices_company_id_idx
  ON public.mobile_devices (company_id);

CREATE INDEX mobile_devices_status_idx
  ON public.mobile_devices (status);

CREATE INDEX mobile_devices_deleted_at_idx
  ON public.mobile_devices (deleted_at);

CREATE OR REPLACE FUNCTION public.set_mobile_devices_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mobile_devices_set_updated_at
  BEFORE UPDATE ON public.mobile_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mobile_devices_updated_at();

ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY mobile_devices_select_policy
  ON public.mobile_devices
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY mobile_devices_insert_policy
  ON public.mobile_devices
  FOR INSERT
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

CREATE POLICY mobile_devices_update_policy
  ON public.mobile_devices
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (NOT public.auth_is_demo_platform_read_only());

COMMENT ON TABLE public.mobile_devices IS 'Registered corporate mobile devices for Bespoke Field Agent.';
COMMENT ON COLUMN public.mobile_devices.device_id IS 'Stable client-generated device identifier.';
COMMENT ON COLUMN public.mobile_devices.work_team_id IS 'Optional assigned field crew / work team.';
