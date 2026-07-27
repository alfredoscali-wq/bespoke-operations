-- Comercial 1.0 — Foundation: prospectos, oportunidades, catálogos y RLS.

CREATE TYPE public.commercial_person_type AS ENUM (
  'individual',
  'company'
);

-- Catalog tables (global seeds; readable with module access).
CREATE TABLE public.commercial_statuses (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commercial_priorities (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commercial_sources (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.commercial_statuses (code, label, sort_order, is_closed) VALUES
  ('nueva', 'Nueva', 10, false),
  ('contactada', 'Contactada', 20, false),
  ('calificada', 'Calificada', 30, false),
  ('propuesta_enviada', 'Propuesta Enviada', 40, false),
  ('negociacion', 'Negociación', 50, false),
  ('ganada', 'Ganada', 60, true),
  ('perdida', 'Perdida', 70, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.commercial_priorities (code, label, sort_order) VALUES
  ('alta', 'Alta', 10),
  ('media', 'Media', 20),
  ('baja', 'Baja', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.commercial_sources (code, label, sort_order) VALUES
  ('whatsapp', 'WhatsApp', 10),
  ('llamada', 'Llamada', 20),
  ('web', 'Web', 30),
  ('facebook', 'Facebook', 40),
  ('instagram', 'Instagram', 50),
  ('referido', 'Referido', 60),
  ('sucursal', 'Sucursal', 70),
  ('otro', 'Otro', 80)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.commercial_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  person_type public.commercial_person_type NOT NULL DEFAULT 'individual',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  document_number text NOT NULL DEFAULT '',
  tax_id text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX commercial_people_company_id_idx
  ON public.commercial_people (company_id);

CREATE INDEX commercial_people_company_email_idx
  ON public.commercial_people (company_id, email);

CREATE INDEX commercial_people_company_phone_idx
  ON public.commercial_people (company_id, phone);

CREATE INDEX commercial_people_company_mobile_idx
  ON public.commercial_people (company_id, mobile);

CREATE INDEX commercial_people_deleted_at_idx
  ON public.commercial_people (deleted_at);

CREATE OR REPLACE FUNCTION public.set_commercial_people_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_people_set_updated_at
  BEFORE UPDATE ON public.commercial_people
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_people_updated_at();

COMMENT ON TABLE public.commercial_people IS
  'Prospectos comerciales (personas o empresas que todavía no son clientes).';

-- Per-company monotonic counter so OP codes are never reused after soft delete.
CREATE TABLE public.commercial_opportunity_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0
    CHECK (last_number >= 0)
);

CREATE TABLE public.commercial_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  person_id uuid NOT NULL REFERENCES public.commercial_people (id) ON DELETE RESTRICT,
  code text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'nueva'
    REFERENCES public.commercial_statuses (code),
  priority text NOT NULL DEFAULT 'media'
    REFERENCES public.commercial_priorities (code),
  source text NOT NULL DEFAULT 'otro'
    REFERENCES public.commercial_sources (code),
  assigned_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  estimated_amount numeric(14, 2),
  probability integer
    CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  expected_close_date date,
  description text NOT NULL DEFAULT '',
  lost_reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT commercial_opportunities_company_code_unique UNIQUE (company_id, code)
);

CREATE INDEX commercial_opportunities_company_id_idx
  ON public.commercial_opportunities (company_id);

CREATE INDEX commercial_opportunities_person_id_idx
  ON public.commercial_opportunities (person_id);

CREATE INDEX commercial_opportunities_company_status_idx
  ON public.commercial_opportunities (company_id, status);

CREATE INDEX commercial_opportunities_assigned_employee_id_idx
  ON public.commercial_opportunities (assigned_employee_id);

CREATE INDEX commercial_opportunities_deleted_at_idx
  ON public.commercial_opportunities (deleted_at);

CREATE OR REPLACE FUNCTION public.set_commercial_opportunities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_opportunities_set_updated_at
  BEFORE UPDATE ON public.commercial_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_opportunities_updated_at();

CREATE OR REPLACE FUNCTION public.assign_commercial_opportunity_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.code IS NOT NULL AND btrim(NEW.code) <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_opportunity_counters (company_id, last_number)
  VALUES (NEW.company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = public.commercial_opportunity_counters.last_number + 1
  RETURNING last_number INTO next_num;

  NEW.code := 'OP-' || lpad(next_num::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_opportunities_assign_code
  BEFORE INSERT ON public.commercial_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_commercial_opportunity_code();

COMMENT ON TABLE public.commercial_opportunities IS
  'Expedientes comerciales (oportunidades) vinculados a prospectos.';
COMMENT ON COLUMN public.commercial_opportunities.code IS
  'Código auto-generado OP-000001…; nunca se reutiliza (contador por empresa).';

-- RLS catalogs (read-only for module users).
ALTER TABLE public.commercial_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_statuses_select_policy
  ON public.commercial_statuses
  FOR SELECT
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

CREATE POLICY commercial_priorities_select_policy
  ON public.commercial_priorities
  FOR SELECT
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

CREATE POLICY commercial_sources_select_policy
  ON public.commercial_sources
  FOR SELECT
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

ALTER TABLE public.commercial_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_opportunity_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_people_select_policy
  ON public.commercial_people
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

CREATE POLICY commercial_people_insert_policy
  ON public.commercial_people
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_people_update_policy
  ON public.commercial_people
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

CREATE POLICY commercial_people_delete_policy
  ON public.commercial_people
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND public.auth_is_administrador()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_opportunities_select_policy
  ON public.commercial_opportunities
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

CREATE POLICY commercial_opportunities_insert_policy
  ON public.commercial_opportunities
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_opportunities_update_policy
  ON public.commercial_opportunities
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

CREATE POLICY commercial_opportunities_delete_policy
  ON public.commercial_opportunities
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND public.auth_is_administrador()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- Counter rows are touched by trigger as the inserting user.
CREATE POLICY commercial_opportunity_counters_select_policy
  ON public.commercial_opportunity_counters
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

CREATE POLICY commercial_opportunity_counters_insert_policy
  ON public.commercial_opportunity_counters
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY commercial_opportunity_counters_update_policy
  ON public.commercial_opportunity_counters
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- Seed module visibility defaults for existing roles.
UPDATE public.company_roles
SET module_visibility = module_visibility || '{"gestion_comercial": true}'::jsonb
WHERE code IN ('administrador', 'administracion', 'ventas');

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"gestion_comercial": false}'::jsonb
WHERE code IN (
  'atencion_cliente',
  'rrhh',
  'tecnica',
  'supervisor',
  'operario',
  'administrativo'
);
