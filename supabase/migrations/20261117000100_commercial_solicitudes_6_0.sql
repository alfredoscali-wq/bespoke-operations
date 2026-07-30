-- Comercial 6.0 — Gestión de Solicitudes del Cliente
-- Bridge between Comercial (Cliente/oportunidad) and future Operaciones (OT / Servicio).

-- ---------------------------------------------------------------------------
-- Catalogs (global, seeded)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commercial_solicitud_types (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_solicitud_types_label_not_blank
    CHECK (char_length(trim(label)) > 0)
);

CREATE TABLE IF NOT EXISTS public.commercial_solicitud_statuses (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_solicitud_statuses_label_not_blank
    CHECK (char_length(trim(label)) > 0)
);

CREATE TABLE IF NOT EXISTS public.commercial_solicitud_priorities (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_solicitud_priorities_label_not_blank
    CHECK (char_length(trim(label)) > 0)
);

INSERT INTO public.commercial_solicitud_types (code, label, sort_order) VALUES
  ('internet', 'Internet', 10),
  ('television', 'Televisión', 20),
  ('telefonia', 'Telefonía', 30),
  ('combo', 'Combo', 40),
  ('otro', 'Otro', 50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.commercial_solicitud_statuses (code, label, sort_order) VALUES
  ('nueva', 'Nueva', 10),
  ('en_gestion', 'En Gestión', 20),
  ('ot_generada', 'OT Generada', 30),
  ('finalizada', 'Finalizada', 40),
  ('cancelada', 'Cancelada', 50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.commercial_solicitud_priorities (code, label, sort_order) VALUES
  ('baja', 'Baja', 10),
  ('normal', 'Normal', 20),
  ('alta', 'Alta', 30),
  ('urgente', 'Urgente', 40)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Counters + solicitudes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commercial_solicitud_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE RESTRICT,
  last_number integer NOT NULL DEFAULT 0,
  CONSTRAINT commercial_solicitud_counters_last_number_non_negative
    CHECK (last_number >= 0)
);

CREATE TABLE IF NOT EXISTS public.commercial_solicitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  opportunity_id uuid NOT NULL
    REFERENCES public.commercial_opportunities (id) ON DELETE RESTRICT,
  code text NOT NULL,
  request_type text NOT NULL
    REFERENCES public.commercial_solicitud_types (code),
  product_plan text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal'
    REFERENCES public.commercial_solicitud_priorities (code),
  status text NOT NULL DEFAULT 'nueva'
    REFERENCES public.commercial_solicitud_statuses (code),
  observations text NOT NULL DEFAULT '',
  responsible_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  -- Prepared for Solicitud → OT conversion (Operaciones). Unused in 6.0.
  work_order_id uuid,
  created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT commercial_solicitudes_company_code_unique UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS commercial_solicitudes_company_created_idx
  ON public.commercial_solicitudes (company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_solicitudes_opportunity_idx
  ON public.commercial_solicitudes (opportunity_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_solicitudes_status_idx
  ON public.commercial_solicitudes (company_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_solicitudes_work_order_idx
  ON public.commercial_solicitudes (work_order_id)
  WHERE deleted_at IS NULL AND work_order_id IS NOT NULL;

COMMENT ON TABLE public.commercial_solicitudes IS
  'Pedidos concretos del cliente. Nexo Comercial → Operaciones (OT / Servicio Activo).';
COMMENT ON COLUMN public.commercial_solicitudes.work_order_id IS
  'Future link to OT generated from this solicitud. Unused in 6.0.';
COMMENT ON COLUMN public.commercial_solicitudes.product_plan IS
  'Free-text product/plan requested (e.g. 300 Mb, TV HD, Triple Play).';

CREATE OR REPLACE FUNCTION public.set_commercial_solicitudes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_solicitudes_set_updated_at
  ON public.commercial_solicitudes;
CREATE TRIGGER commercial_solicitudes_set_updated_at
  BEFORE UPDATE ON public.commercial_solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_solicitudes_updated_at();

CREATE OR REPLACE FUNCTION public.assign_commercial_solicitud_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.code IS NOT NULL AND btrim(NEW.code) <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_solicitud_counters (company_id, last_number)
  VALUES (NEW.company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = public.commercial_solicitud_counters.last_number + 1
  RETURNING last_number INTO next_num;

  NEW.code := 'SOL-' || lpad(next_num::text, 6, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_solicitudes_assign_code
  ON public.commercial_solicitudes;
CREATE TRIGGER commercial_solicitudes_assign_code
  BEFORE INSERT ON public.commercial_solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_commercial_solicitud_code();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.commercial_solicitud_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_solicitud_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_solicitud_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_solicitud_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_solicitud_types_select_policy
  ON public.commercial_solicitud_types;
CREATE POLICY commercial_solicitud_types_select_policy
  ON public.commercial_solicitud_types
  FOR SELECT
  TO authenticated
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

DROP POLICY IF EXISTS commercial_solicitud_statuses_select_policy
  ON public.commercial_solicitud_statuses;
CREATE POLICY commercial_solicitud_statuses_select_policy
  ON public.commercial_solicitud_statuses
  FOR SELECT
  TO authenticated
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

DROP POLICY IF EXISTS commercial_solicitud_priorities_select_policy
  ON public.commercial_solicitud_priorities;
CREATE POLICY commercial_solicitud_priorities_select_policy
  ON public.commercial_solicitud_priorities
  FOR SELECT
  TO authenticated
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

-- Counter rows are touched by trigger as the inserting user.
DROP POLICY IF EXISTS commercial_solicitud_counters_select_policy
  ON public.commercial_solicitud_counters;
CREATE POLICY commercial_solicitud_counters_select_policy
  ON public.commercial_solicitud_counters
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

DROP POLICY IF EXISTS commercial_solicitud_counters_insert_policy
  ON public.commercial_solicitud_counters;
CREATE POLICY commercial_solicitud_counters_insert_policy
  ON public.commercial_solicitud_counters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS commercial_solicitud_counters_update_policy
  ON public.commercial_solicitud_counters;
CREATE POLICY commercial_solicitud_counters_update_policy
  ON public.commercial_solicitud_counters
  FOR UPDATE
  TO authenticated
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

DROP POLICY IF EXISTS commercial_solicitudes_select_policy
  ON public.commercial_solicitudes;
CREATE POLICY commercial_solicitudes_select_policy
  ON public.commercial_solicitudes
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
  );

DROP POLICY IF EXISTS commercial_solicitudes_insert_policy
  ON public.commercial_solicitudes;
CREATE POLICY commercial_solicitudes_insert_policy
  ON public.commercial_solicitudes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS commercial_solicitudes_update_policy
  ON public.commercial_solicitudes;
CREATE POLICY commercial_solicitudes_update_policy
  ON public.commercial_solicitudes
  FOR UPDATE
  TO authenticated
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

DROP POLICY IF EXISTS commercial_solicitudes_delete_policy
  ON public.commercial_solicitudes;
CREATE POLICY commercial_solicitudes_delete_policy
  ON public.commercial_solicitudes
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('gestion_comercial')
    AND public.auth_is_administrador()
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT ON TABLE public.commercial_solicitud_types TO authenticated;
GRANT SELECT ON TABLE public.commercial_solicitud_statuses TO authenticated;
GRANT SELECT ON TABLE public.commercial_solicitud_priorities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commercial_solicitud_counters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commercial_solicitudes TO authenticated;

GRANT ALL ON TABLE public.commercial_solicitud_types TO service_role;
GRANT ALL ON TABLE public.commercial_solicitud_statuses TO service_role;
GRANT ALL ON TABLE public.commercial_solicitud_priorities TO service_role;
GRANT ALL ON TABLE public.commercial_solicitud_counters TO service_role;
GRANT ALL ON TABLE public.commercial_solicitudes TO service_role;
