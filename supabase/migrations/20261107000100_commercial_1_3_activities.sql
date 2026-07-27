-- Comercial 1.3 — Motor de actividades comerciales.

CREATE TYPE public.commercial_activity_status AS ENUM (
  'pending',
  'completed'
);

CREATE TABLE public.commercial_activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.commercial_activity_types (code, label, sort_order) VALUES
  ('llamada', 'Llamada', 10),
  ('whatsapp', 'WhatsApp', 20),
  ('email', 'Email', 30),
  ('visita', 'Visita', 40),
  ('reunion', 'Reunión', 50),
  ('nota', 'Nota', 60),
  ('tarea', 'Tarea', 70),
  ('seguimiento', 'Seguimiento', 80),
  ('cambio_estado', 'Cambio de Estado', 90),
  ('sistema', 'Sistema', 100)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.commercial_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  opportunity_id uuid NOT NULL REFERENCES public.commercial_opportunities (id) ON DELETE RESTRICT,
  activity_type_id uuid NOT NULL REFERENCES public.commercial_activity_types (id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  completed_at timestamptz,
  status public.commercial_activity_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX commercial_activities_company_id_idx
  ON public.commercial_activities (company_id);

CREATE INDEX commercial_activities_opportunity_id_idx
  ON public.commercial_activities (opportunity_id);

CREATE INDEX commercial_activities_employee_id_idx
  ON public.commercial_activities (employee_id);

CREATE INDEX commercial_activities_activity_type_id_idx
  ON public.commercial_activities (activity_type_id);

CREATE INDEX commercial_activities_status_idx
  ON public.commercial_activities (company_id, status);

CREATE INDEX commercial_activities_scheduled_at_idx
  ON public.commercial_activities (scheduled_at);

CREATE INDEX commercial_activities_deleted_at_idx
  ON public.commercial_activities (deleted_at);

CREATE INDEX commercial_activities_company_opportunity_created_idx
  ON public.commercial_activities (company_id, opportunity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_commercial_activities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_activities_set_updated_at
  BEFORE UPDATE ON public.commercial_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_activities_updated_at();

COMMENT ON TABLE public.commercial_activities IS
  'Interacciones comerciales sobre una oportunidad (base de timeline / reportes).';
COMMENT ON TABLE public.commercial_activity_types IS
  'Catálogo de tipos de actividad comercial.';

ALTER TABLE public.commercial_activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_activity_types_select_policy
  ON public.commercial_activity_types
  FOR SELECT
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

CREATE POLICY commercial_activities_select_policy
  ON public.commercial_activities
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

CREATE POLICY commercial_activities_insert_policy
  ON public.commercial_activities
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_activities_update_policy
  ON public.commercial_activities
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_activities_delete_policy
  ON public.commercial_activities
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND public.auth_is_administrador()
    AND NOT public.auth_is_demo_platform_read_only()
  );
