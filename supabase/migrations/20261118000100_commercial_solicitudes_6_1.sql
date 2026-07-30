-- Comercial 6.1 — Ciclo de vida de Solicitudes + tipos configurables por empresa.

-- ---------------------------------------------------------------------------
-- Resolutions catalog (global; prepared for future tenant configuration)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commercial_solicitud_resolutions (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  -- Target status after resolving (except venta_concretada, which awaits OT).
  resulting_status text
    REFERENCES public.commercial_solicitud_statuses (code),
  allows_ot_generation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_solicitud_resolutions_label_not_blank
    CHECK (char_length(trim(label)) > 0)
);

INSERT INTO public.commercial_solicitud_resolutions
  (code, label, sort_order, resulting_status, allows_ot_generation)
VALUES
  ('venta_concretada', 'Venta concretada', 10, 'en_gestion', true),
  ('cliente_desistio', 'Cliente desistió', 20, 'finalizada', false),
  ('no_interesado', 'No interesado', 30, 'finalizada', false),
  ('sin_cobertura', 'Sin cobertura', 40, 'finalizada', false),
  ('cancelada', 'Cancelada', 50, 'cancelada', false),
  ('pendiente_decision', 'Pendiente de decisión', 60, 'en_gestion', false)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.commercial_solicitud_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_solicitud_resolutions_select_policy
  ON public.commercial_solicitud_resolutions;
CREATE POLICY commercial_solicitud_resolutions_select_policy
  ON public.commercial_solicitud_resolutions
  FOR SELECT
  TO authenticated
  USING (public.auth_user_has_allowed_module('gestion_comercial'));

GRANT SELECT ON TABLE public.commercial_solicitud_resolutions TO authenticated;
GRANT ALL ON TABLE public.commercial_solicitud_resolutions TO service_role;

-- ---------------------------------------------------------------------------
-- Tenant-configurable request types (replaces global commercial_solicitud_types)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commercial_solicitud_type_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT commercial_solicitud_type_defs_name_not_blank
    CHECK (char_length(trim(name)) > 0),
  CONSTRAINT commercial_solicitud_type_defs_sort_order_positive
    CHECK (sort_order > 0),
  CONSTRAINT commercial_solicitud_type_defs_color_not_blank
    CHECK (char_length(trim(color)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_solicitud_type_defs_company_name_active_unique
  ON public.commercial_solicitud_type_defs (company_id, lower(trim(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_solicitud_type_defs_company_active_idx
  ON public.commercial_solicitud_type_defs (company_id, is_active, sort_order)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_commercial_solicitud_type_defs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_solicitud_type_defs_set_updated_at
  ON public.commercial_solicitud_type_defs;
CREATE TRIGGER commercial_solicitud_type_defs_set_updated_at
  BEFORE UPDATE ON public.commercial_solicitud_type_defs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_solicitud_type_defs_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_manage_commercial_solicitud_types()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.auth_user_system_role() = 'supervisor'
    OR public.auth_user_has_allowed_module('settings')
  )
  AND NOT public.auth_is_demo_platform_read_only();
$$;

ALTER TABLE public.commercial_solicitud_type_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_solicitud_type_defs_select_policy
  ON public.commercial_solicitud_type_defs;
CREATE POLICY commercial_solicitud_type_defs_select_policy
  ON public.commercial_solicitud_type_defs
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS commercial_solicitud_type_defs_insert_policy
  ON public.commercial_solicitud_type_defs;
CREATE POLICY commercial_solicitud_type_defs_insert_policy
  ON public.commercial_solicitud_type_defs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_solicitud_types()
  );

DROP POLICY IF EXISTS commercial_solicitud_type_defs_update_policy
  ON public.commercial_solicitud_type_defs;
CREATE POLICY commercial_solicitud_type_defs_update_policy
  ON public.commercial_solicitud_type_defs
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_solicitud_types()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_solicitud_types()
  );

DROP POLICY IF EXISTS commercial_solicitud_type_defs_delete_policy
  ON public.commercial_solicitud_type_defs;
CREATE POLICY commercial_solicitud_type_defs_delete_policy
  ON public.commercial_solicitud_type_defs
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_solicitud_types()
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commercial_solicitud_type_defs TO authenticated;
GRANT ALL ON TABLE public.commercial_solicitud_type_defs TO service_role;

-- Seed default types for every existing company (idempotent by unique name).
INSERT INTO public.commercial_solicitud_type_defs (company_id, name, color, sort_order)
SELECT c.id, d.name, d.color, d.sort_order
FROM public.companies c
CROSS JOIN (
  VALUES
    ('Internet', '#2563eb', 10),
    ('Televisión', '#7c3aed', 20),
    ('Telefonía', '#0891b2', 30),
    ('Combo', '#16a34a', 40),
    ('Otro', '#64748b', 50)
) AS d(name, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.commercial_solicitud_type_defs existing
  WHERE existing.company_id = c.id
    AND existing.deleted_at IS NULL
    AND lower(trim(existing.name)) = lower(trim(d.name))
);

-- ---------------------------------------------------------------------------
-- Migrate commercial_solicitudes.request_type → request_type_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.commercial_solicitudes
  ADD COLUMN IF NOT EXISTS request_type_id uuid
    REFERENCES public.commercial_solicitud_type_defs (id) ON DELETE RESTRICT;

ALTER TABLE public.commercial_solicitudes
  ADD COLUMN IF NOT EXISTS resolution_code text
    REFERENCES public.commercial_solicitud_resolutions (code);

-- Map legacy global codes to seeded type names.
UPDATE public.commercial_solicitudes s
SET request_type_id = t.id
FROM public.commercial_solicitud_type_defs t
WHERE s.request_type_id IS NULL
  AND s.company_id = t.company_id
  AND t.deleted_at IS NULL
  AND lower(trim(t.name)) = lower(trim(
    CASE s.request_type
      WHEN 'internet' THEN 'Internet'
      WHEN 'television' THEN 'Televisión'
      WHEN 'telefonia' THEN 'Telefonía'
      WHEN 'combo' THEN 'Combo'
      WHEN 'otro' THEN 'Otro'
      ELSE s.request_type
    END
  ));

-- Fallback: any remaining rows → "Otro" for that company.
UPDATE public.commercial_solicitudes s
SET request_type_id = t.id
FROM public.commercial_solicitud_type_defs t
WHERE s.request_type_id IS NULL
  AND s.company_id = t.company_id
  AND t.deleted_at IS NULL
  AND lower(trim(t.name)) = 'otro';

ALTER TABLE public.commercial_solicitudes
  ALTER COLUMN request_type_id SET NOT NULL;

ALTER TABLE public.commercial_solicitudes
  DROP CONSTRAINT IF EXISTS commercial_solicitudes_request_type_fkey;

ALTER TABLE public.commercial_solicitudes
  DROP COLUMN IF EXISTS request_type;

CREATE INDEX IF NOT EXISTS commercial_solicitudes_type_idx
  ON public.commercial_solicitudes (request_type_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_solicitudes_resolution_idx
  ON public.commercial_solicitudes (resolution_code)
  WHERE deleted_at IS NULL AND resolution_code IS NOT NULL;

COMMENT ON COLUMN public.commercial_solicitudes.resolution_code IS
  'Outcome of Resolver Solicitud. venta_concretada enables OT generation.';
COMMENT ON COLUMN public.commercial_solicitudes.work_order_id IS
  'Permanent link Solicitud → OT after Generar Orden de Trabajo.';

-- Drop obsolete global types catalog (replaced by type_defs).
DROP POLICY IF EXISTS commercial_solicitud_types_select_policy
  ON public.commercial_solicitud_types;
DROP TABLE IF EXISTS public.commercial_solicitud_types;
