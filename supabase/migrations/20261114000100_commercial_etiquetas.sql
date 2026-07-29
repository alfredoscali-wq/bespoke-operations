-- Commercial etiquetas (labels) — per-company catalog for Gestión Comercial MVP.
-- No seed data: each company configures its own labels.

CREATE TABLE IF NOT EXISTS public.commercial_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT commercial_etiquetas_name_not_blank
    CHECK (char_length(trim(name)) > 0),
  CONSTRAINT commercial_etiquetas_sort_order_positive
    CHECK (sort_order > 0),
  CONSTRAINT commercial_etiquetas_color_not_blank
    CHECK (char_length(trim(color)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_etiquetas_company_name_active_unique
  ON public.commercial_etiquetas (company_id, lower(trim(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_etiquetas_company_active_idx
  ON public.commercial_etiquetas (company_id, is_active, sort_order)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.commercial_etiquetas IS
  'Tenant-configurable commercial labels (etiquetas) for Gestión Comercial.';

CREATE OR REPLACE FUNCTION public.set_commercial_etiquetas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_etiquetas_set_updated_at ON public.commercial_etiquetas;
CREATE TRIGGER commercial_etiquetas_set_updated_at
  BEFORE UPDATE ON public.commercial_etiquetas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_etiquetas_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_manage_commercial_etiquetas()
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

ALTER TABLE public.commercial_etiquetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_etiquetas_select_policy ON public.commercial_etiquetas;
CREATE POLICY commercial_etiquetas_select_policy
  ON public.commercial_etiquetas
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS commercial_etiquetas_insert_policy ON public.commercial_etiquetas;
CREATE POLICY commercial_etiquetas_insert_policy
  ON public.commercial_etiquetas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_etiquetas()
  );

DROP POLICY IF EXISTS commercial_etiquetas_update_policy ON public.commercial_etiquetas;
CREATE POLICY commercial_etiquetas_update_policy
  ON public.commercial_etiquetas
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_etiquetas()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_etiquetas()
  );

DROP POLICY IF EXISTS commercial_etiquetas_delete_policy ON public.commercial_etiquetas;
CREATE POLICY commercial_etiquetas_delete_policy
  ON public.commercial_etiquetas
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_commercial_etiquetas()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_etiquetas TO authenticated;
GRANT ALL ON TABLE public.commercial_etiquetas TO service_role;

-- Optional FK on opportunities (nullable for existing rows; required by app on new creates).
ALTER TABLE public.commercial_opportunities
  ADD COLUMN IF NOT EXISTS etiqueta_id uuid
    REFERENCES public.commercial_etiquetas (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_opportunities_etiqueta_id_idx
  ON public.commercial_opportunities (etiqueta_id)
  WHERE deleted_at IS NULL AND etiqueta_id IS NOT NULL;
