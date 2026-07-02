-- Sprint 1.0.1: operational task start traceability + incident types per WO type.

CREATE TABLE IF NOT EXISTS public.task_execution_starts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  work_team_id uuid NOT NULL,
  mobile_device_id uuid NOT NULL REFERENCES public.mobile_devices (id) ON DELETE RESTRICT,
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_meters double precision,
  distance_to_client_meters double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_execution_starts_task_idx
  ON public.task_execution_starts (task_id, started_at DESC);

CREATE INDEX IF NOT EXISTS task_execution_starts_company_started_at_idx
  ON public.task_execution_starts (company_id, started_at DESC);

COMMENT ON TABLE public.task_execution_starts IS
  'Field Agent operational start events for audit, traceability and reporting.';

CREATE TABLE IF NOT EXISTS public.work_order_type_incident_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  service_type text NOT NULL,
  incident_type_id uuid NOT NULL REFERENCES public.incident_types (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_order_type_incident_types_sort_order_positive
    CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS work_order_type_incident_types_unique
  ON public.work_order_type_incident_types (company_id, service_type, incident_type_id);

CREATE INDEX IF NOT EXISTS work_order_type_incident_types_lookup_idx
  ON public.work_order_type_incident_types (company_id, service_type, sort_order);

COMMENT ON TABLE public.work_order_type_incident_types IS
  'Incident types enabled for a work order service type during Field Agent execution.';

CREATE OR REPLACE FUNCTION public.set_work_order_type_incident_types_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_order_type_incident_types_set_updated_at
  ON public.work_order_type_incident_types;

CREATE TRIGGER work_order_type_incident_types_set_updated_at
  BEFORE UPDATE ON public.work_order_type_incident_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_work_order_type_incident_types_updated_at();

ALTER TABLE public.task_execution_starts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_type_incident_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_execution_starts_select_policy
  ON public.task_execution_starts
  FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY work_order_type_incident_types_select_policy
  ON public.work_order_type_incident_types
  FOR SELECT
  USING (company_id = public.auth_company_id());
