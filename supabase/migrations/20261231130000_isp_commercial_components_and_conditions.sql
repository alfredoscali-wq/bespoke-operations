-- Commercial components and conditions on a contracted ISP service.
-- The base product stays isp_service_catalog. Combinations are not new plans.
-- Does not backfill customers, work orders, billing lines or TV activation.

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS price_subtotal numeric(12, 2)
    CHECK (price_subtotal IS NULL OR price_subtotal >= 0);

ALTER TABLE public.isp_services
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2)
    CHECK (discount_amount IS NULL OR discount_amount >= 0);

COMMENT ON COLUMN public.isp_services.price_subtotal IS
  'Base list price plus active recurring commercial components. Null until a component or condition is assigned.';
COMMENT ON COLUMN public.isp_services.discount_amount IS
  'Amount removed by the active commercial condition. Null until a component or condition is assigned.';
COMMENT ON COLUMN public.isp_services.monthly_fee IS
  'Price charged for the service. After a commercial component or condition is assigned, this is price_subtotal minus discount_amount.';

CREATE TABLE public.isp_commercial_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  component_type text NOT NULL
    CHECK (component_type IN ('addon', 'tv_upgrade')),
  monthly_price numeric(12, 2)
    CHECK (monthly_price IS NULL OR monthly_price >= 0),
  currency text NOT NULL DEFAULT 'ARS',
  is_recurring boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  compatibility jsonb NOT NULL,
  exclusive_group text,
  tv_plan_catalog_id uuid REFERENCES public.isp_service_catalog (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.isp_commercial_components IS
  'Sellable add-ons and TV upgrades. Not isp_service_catalog plans.';
COMMENT ON COLUMN public.isp_commercial_components.compatibility IS
  'Matched against the base catalog row and its tv_plan_catalog target. Keys: category, requiresIncludedTv, includedTvCode. Price calculation does not read this column.';
COMMENT ON COLUMN public.isp_commercial_components.exclusive_group IS
  'At most one active assignment of this group per contracted service. Null means no group.';
COMMENT ON COLUMN public.isp_commercial_components.tv_plan_catalog_id IS
  'TV plan a tv_upgrade selects. The charged amount is monthly_price, not that plan''s price.';
COMMENT ON COLUMN public.isp_commercial_components.monthly_price IS
  'Null means the component cannot be assigned yet.';

CREATE UNIQUE INDEX isp_commercial_components_company_code_idx
  ON public.isp_commercial_components (company_id, lower(code))
  WHERE deleted_at IS NULL;

CREATE TABLE public.isp_service_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  service_id uuid NOT NULL REFERENCES public.isp_services (id) ON DELETE RESTRICT,
  component_id uuid NOT NULL REFERENCES public.isp_commercial_components (id) ON DELETE RESTRICT,
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  is_recurring boolean NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.isp_service_components IS
  'Component assigned to one contracted service. unit_price is a snapshot.';

CREATE UNIQUE INDEX isp_service_components_one_active_idx
  ON public.isp_service_components (service_id, component_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX isp_service_components_service_idx
  ON public.isp_service_components (company_id, service_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.isp_commercial_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  discount_percent numeric(5, 2) NOT NULL
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.isp_commercial_conditions IS
  'Named percent discounts. Not catalog plans and not invoice line discounts.';

CREATE UNIQUE INDEX isp_commercial_conditions_company_code_idx
  ON public.isp_commercial_conditions (company_id, lower(code))
  WHERE deleted_at IS NULL;

CREATE TABLE public.isp_service_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  service_id uuid NOT NULL REFERENCES public.isp_services (id) ON DELETE RESTRICT,
  condition_id uuid NOT NULL REFERENCES public.isp_commercial_conditions (id) ON DELETE RESTRICT,
  discount_percent numeric(5, 2) NOT NULL
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.isp_service_conditions IS
  'One active commercial condition per contracted service. discount_percent is a snapshot.';

CREATE UNIQUE INDEX isp_service_conditions_one_active_idx
  ON public.isp_service_conditions (service_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX isp_service_conditions_service_idx
  ON public.isp_service_conditions (company_id, service_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.isp_commercial_compatibility_valid(p_compatibility jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_compatibility IS NULL OR jsonb_typeof(p_compatibility) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  FOR v_key IN
    SELECT jsonb_object_keys(p_compatibility)
  LOOP
    IF v_key NOT IN ('category', 'requiresIncludedTv', 'includedTvCode') THEN
      RETURN false;
    END IF;
  END LOOP;

  IF p_compatibility ? 'category'
     AND (
       jsonb_typeof(p_compatibility -> 'category') IS DISTINCT FROM 'string'
       OR (p_compatibility ->> 'category') IS DISTINCT FROM 'internet'
     ) THEN
    RETURN false;
  END IF;

  IF p_compatibility ? 'requiresIncludedTv'
     AND jsonb_typeof(p_compatibility -> 'requiresIncludedTv') IS DISTINCT FROM 'boolean' THEN
    RETURN false;
  END IF;

  IF p_compatibility ? 'includedTvCode'
     AND (
       jsonb_typeof(p_compatibility -> 'includedTvCode') IS DISTINCT FROM 'string'
       OR btrim(p_compatibility ->> 'includedTvCode') = ''
     ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.isp_component_matches_catalog(
  p_compatibility jsonb,
  p_category text,
  p_included_tv_code text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    public.isp_commercial_compatibility_valid(p_compatibility)
    AND (
      NOT (p_compatibility ? 'category')
      OR lower(btrim(COALESCE(p_category, ''))) = lower(p_compatibility ->> 'category')
    )
    AND (
      COALESCE((p_compatibility ->> 'requiresIncludedTv')::boolean, false) IS NOT TRUE
      OR NULLIF(btrim(COALESCE(p_included_tv_code, '')), '') IS NOT NULL
    )
    AND (
      NOT (p_compatibility ? 'includedTvCode')
      OR lower(btrim(COALESCE(p_included_tv_code, '')))
         = lower(btrim(p_compatibility ->> 'includedTvCode'))
    );
$$;

CREATE OR REPLACE FUNCTION public.enforce_isp_commercial_component_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tv public.isp_service_catalog%ROWTYPE;
BEGIN
  IF NOT public.isp_commercial_compatibility_valid(NEW.compatibility) THEN
    RAISE EXCEPTION 'La compatibilidad del componente comercial no es válida.';
  END IF;

  IF NEW.component_type = 'addon' THEN
    NEW.tv_plan_catalog_id := NULL;
  ELSIF NEW.tv_plan_catalog_id IS NULL THEN
    RAISE EXCEPTION 'El upgrade de TV requiere un plan TV.';
  END IF;

  IF NEW.tv_plan_catalog_id IS NOT NULL THEN
    SELECT *
      INTO v_tv
    FROM public.isp_service_catalog
    WHERE id = NEW.tv_plan_catalog_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El upgrade de TV requiere un plan TV existente.';
    END IF;

    IF v_tv.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El componente no puede usar un plan TV de otra empresa.';
    END IF;

    IF v_tv.category IS DISTINCT FROM 'tv' THEN
      RAISE EXCEPTION 'El upgrade de TV debe apuntar a un plan de categoría TV.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_commercial_components_enforce_row
  BEFORE INSERT OR UPDATE ON public.isp_commercial_components
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_commercial_component_row();

CREATE TRIGGER isp_commercial_components_set_updated_at
  BEFORE UPDATE ON public.isp_commercial_components
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_commercial_conditions_set_updated_at
  BEFORE UPDATE ON public.isp_commercial_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_service_components_set_updated_at
  BEFORE UPDATE ON public.isp_service_components
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_service_conditions_set_updated_at
  BEFORE UPDATE ON public.isp_service_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_isp_service_component_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_service public.isp_services%ROWTYPE;
  v_component public.isp_commercial_components%ROWTYPE;
  v_base public.isp_service_catalog%ROWTYPE;
  v_tv_code text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.unit_price := OLD.unit_price;
    NEW.is_recurring := OLD.is_recurring;
    NEW.component_id := OLD.component_id;
    NEW.service_id := OLD.service_id;
  END IF;

  SELECT *
    INTO v_service
  FROM public.isp_services
  WHERE id = NEW.service_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El componente requiere un servicio contratado existente.';
  END IF;

  IF v_service.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El componente no puede asignarse a un servicio de otra empresa.';
  END IF;

  SELECT *
    INTO v_component
  FROM public.isp_commercial_components
  WHERE id = NEW.component_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El componente comercial no existe.';
  END IF;

  IF v_component.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El componente comercial es de otra empresa.';
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_component.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'El componente comercial no está activo.';
  END IF;

  IF v_component.monthly_price IS NULL OR v_component.monthly_price < 0 THEN
    RAISE EXCEPTION 'El componente comercial no tiene precio y no se puede asignar.';
  END IF;

  IF v_service.catalog_id IS NULL THEN
    RAISE EXCEPTION 'El servicio contratado no tiene abono base.';
  END IF;

  SELECT *
    INTO v_base
  FROM public.isp_service_catalog
  WHERE id = v_service.catalog_id
    AND deleted_at IS NULL
    AND company_id = NEW.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El abono base del servicio no existe.';
  END IF;

  SELECT code
    INTO v_tv_code
  FROM public.isp_service_catalog
  WHERE id = v_base.tv_plan_catalog_id
    AND deleted_at IS NULL
    AND company_id = NEW.company_id;

  IF NOT public.isp_component_matches_catalog(
    v_component.compatibility,
    v_base.category,
    v_tv_code
  ) THEN
    RAISE EXCEPTION 'El componente comercial no aplica a este abono base.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.unit_price := v_component.monthly_price;
    NEW.is_recurring := v_component.is_recurring;
  END IF;

  IF NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.isp_service_components existing
      WHERE existing.service_id = NEW.service_id
        AND existing.component_id = NEW.component_id
        AND existing.id IS DISTINCT FROM NEW.id
        AND existing.deleted_at IS NULL
        AND existing.status = 'active'
    ) THEN
      RAISE EXCEPTION 'El servicio ya tiene este componente activo.';
    END IF;

    IF v_component.exclusive_group IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.isp_service_components existing
      JOIN public.isp_commercial_components other
        ON other.id = existing.component_id
      WHERE existing.service_id = NEW.service_id
        AND existing.id IS DISTINCT FROM NEW.id
        AND existing.deleted_at IS NULL
        AND existing.status = 'active'
        AND other.deleted_at IS NULL
        AND other.exclusive_group = v_component.exclusive_group
    ) THEN
      RAISE EXCEPTION 'El servicio ya tiene un componente activo de este grupo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_service_components_enforce_assignment
  BEFORE INSERT OR UPDATE ON public.isp_service_components
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_service_component_assignment();

CREATE OR REPLACE FUNCTION public.enforce_isp_service_condition_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_service public.isp_services%ROWTYPE;
  v_condition public.isp_commercial_conditions%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.discount_percent := OLD.discount_percent;
    NEW.condition_id := OLD.condition_id;
    NEW.service_id := OLD.service_id;
  END IF;

  SELECT *
    INTO v_service
  FROM public.isp_services
  WHERE id = NEW.service_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La condición requiere un servicio contratado existente.';
  END IF;

  IF v_service.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La condición no puede asignarse a un servicio de otra empresa.';
  END IF;

  SELECT *
    INTO v_condition
  FROM public.isp_commercial_conditions
  WHERE id = NEW.condition_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La condición comercial no existe.';
  END IF;

  IF v_condition.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La condición comercial es de otra empresa.';
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_condition.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'La condición comercial no está activa.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.discount_percent := v_condition.discount_percent;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_service_conditions_enforce_assignment
  BEFORE INSERT OR UPDATE ON public.isp_service_conditions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_service_condition_assignment();

CREATE OR REPLACE FUNCTION public.apply_isp_service_commercial_price(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_list_price numeric(12, 2);
  v_catalog_price numeric(12, 2);
  v_base numeric(12, 2);
  v_components numeric(12, 2);
  v_percent numeric(5, 2);
  v_subtotal numeric(12, 2);
  v_discount numeric(12, 2);
  v_final numeric(12, 2);
BEGIN
  SELECT service.list_price, catalog.monthly_price
    INTO v_list_price, v_catalog_price
  FROM public.isp_services service
  LEFT JOIN public.isp_service_catalog catalog
    ON catalog.id = service.catalog_id
   AND catalog.deleted_at IS NULL
   AND catalog.company_id = service.company_id
  WHERE service.id = p_service_id
    AND service.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_base := COALESCE(v_list_price, v_catalog_price);
  IF v_base IS NULL OR v_base < 0 THEN
    RAISE EXCEPTION 'El abono base no tiene precio de lista.';
  END IF;

  SELECT COALESCE(SUM(assignment.unit_price), 0)
    INTO v_components
  FROM public.isp_service_components assignment
  WHERE assignment.service_id = p_service_id
    AND assignment.deleted_at IS NULL
    AND assignment.status = 'active'
    AND assignment.is_recurring;

  SELECT assignment.discount_percent
    INTO v_percent
  FROM public.isp_service_conditions assignment
  WHERE assignment.service_id = p_service_id
    AND assignment.deleted_at IS NULL
    AND assignment.status = 'active'
  LIMIT 1;

  v_percent := COALESCE(v_percent, 0);
  v_subtotal := ROUND(v_base + v_components, 2);
  v_discount := ROUND(v_subtotal * v_percent / 100.0, 2);
  v_final := ROUND(GREATEST(v_subtotal - v_discount, 0), 2);

  UPDATE public.isp_services
  SET
    price_subtotal = v_subtotal,
    discount_amount = v_discount,
    monthly_fee = v_final
  WHERE id = p_service_id
    AND deleted_at IS NULL
    AND (
      price_subtotal IS DISTINCT FROM v_subtotal
      OR discount_amount IS DISTINCT FROM v_discount
      OR monthly_fee IS DISTINCT FROM v_final
    );
END;
$$;

COMMENT ON FUNCTION public.apply_isp_service_commercial_price(uuid) IS
  'Writes price_subtotal, discount_amount and monthly_fee for one service. Does not read component codes.';

CREATE OR REPLACE FUNCTION public.refresh_isp_service_commercial_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_isp_service_commercial_price(
    COALESCE(NEW.service_id, OLD.service_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER isp_service_components_refresh_price
  AFTER INSERT OR UPDATE OR DELETE ON public.isp_service_components
  FOR EACH ROW EXECUTE FUNCTION public.refresh_isp_service_commercial_price();

CREATE TRIGGER isp_service_conditions_refresh_price
  AFTER INSERT OR UPDATE OR DELETE ON public.isp_service_conditions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_isp_service_commercial_price();

ALTER TABLE public.isp_commercial_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_service_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_commercial_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_service_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_commercial_components_select_policy
  ON public.isp_commercial_components
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
  );

CREATE POLICY isp_commercial_components_insert_policy
  ON public.isp_commercial_components
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_commercial_components_update_policy
  ON public.isp_commercial_components
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_service_components_select_policy
  ON public.isp_service_components
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
  );

CREATE POLICY isp_service_components_insert_policy
  ON public.isp_service_components
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_service_components_update_policy
  ON public.isp_service_components
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_commercial_conditions_select_policy
  ON public.isp_commercial_conditions
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
  );

CREATE POLICY isp_commercial_conditions_insert_policy
  ON public.isp_commercial_conditions
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_commercial_conditions_update_policy
  ON public.isp_commercial_conditions
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_service_conditions_select_policy
  ON public.isp_service_conditions
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
  );

CREATE POLICY isp_service_conditions_insert_policy
  ON public.isp_service_conditions
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_service_conditions_update_policy
  ON public.isp_service_conditions
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('clientes_360')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.isp_commercial_components TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.isp_service_components TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.isp_commercial_conditions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.isp_service_conditions TO authenticated;

REVOKE ALL ON FUNCTION public.apply_isp_service_commercial_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_isp_service_commercial_price(uuid) TO authenticated;

DO $$
DECLARE
  v_company uuid := '00000000-0000-4000-8000-000000000002';
  v_tv_full uuid;
  v_tv_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company) THEN
    RAISE EXCEPTION 'No se encontró la empresa ABNet.';
  END IF;

  SELECT count(*)
    INTO v_tv_count
  FROM public.isp_service_catalog
  WHERE company_id = v_company
    AND deleted_at IS NULL
    AND is_active = true
    AND category = 'tv'
    AND lower(btrim(code)) = 'tv-full';

  IF v_tv_count <> 1 THEN
    RAISE EXCEPTION
      'ABNet debe tener exactamente un plan TV-FULL activo. Encontrados: %.',
      v_tv_count;
  END IF;

  SELECT id
    INTO v_tv_full
  FROM public.isp_service_catalog
  WHERE company_id = v_company
    AND deleted_at IS NULL
    AND is_active = true
    AND category = 'tv'
    AND lower(btrim(code)) = 'tv-full';

  INSERT INTO public.isp_commercial_components (
    company_id,
    code,
    name,
    description,
    component_type,
    monthly_price,
    currency,
    is_recurring,
    is_active,
    compatibility,
    exclusive_group,
    tv_plan_catalog_id
  )
  SELECT
    v_company,
    seed.code,
    seed.name,
    seed.description,
    seed.component_type,
    seed.monthly_price,
    'ARS',
    true,
    seed.is_active,
    seed.compatibility,
    seed.exclusive_group,
    CASE WHEN seed.component_type = 'tv_upgrade' THEN v_tv_full ELSE NULL END
  FROM (
    VALUES
      (
        'PACK-FUTBOL'::text,
        'Pack Fútbol'::text,
        'Adicional recurrente para un abono con TV incluida.'::text,
        'addon'::text,
        3000.00::numeric,
        true,
        '{"category":"internet","requiresIncludedTv":true}'::jsonb,
        NULL::text
      ),
      (
        'IP-PUBLICA'::text,
        'IP Pública'::text,
        'Adicional de Internet. Sin precio definido: no se puede asignar.'::text,
        'addon'::text,
        NULL::numeric,
        false,
        '{"category":"internet"}'::jsonb,
        NULL::text
      ),
      (
        'TV-FULL-UPGRADE'::text,
        'TV Full'::text,
        'Diferencia entre TV Full y la TV Básica incluida en el abono.'::text,
        'tv_upgrade'::text,
        5400.00::numeric,
        true,
        '{"category":"internet","requiresIncludedTv":true,"includedTvCode":"TV-BASICO"}'::jsonb,
        'tv_tier'::text
      )
  ) AS seed(
    code,
    name,
    description,
    component_type,
    monthly_price,
    is_active,
    compatibility,
    exclusive_group
  )
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.isp_commercial_components existing
    WHERE existing.company_id = v_company
      AND existing.deleted_at IS NULL
      AND lower(existing.code) = lower(seed.code)
  );

  INSERT INTO public.isp_commercial_conditions (
    company_id,
    code,
    name,
    description,
    discount_percent,
    is_active
  )
  SELECT
    v_company,
    seed.code,
    seed.name,
    seed.description,
    seed.discount_percent,
    true
  FROM (
    VALUES
      (
        'JUBILADO'::text,
        'Jubilado'::text,
        'Descuento del 50% sobre el subtotal del servicio.'::text,
        50.00::numeric
      ),
      (
        'CONVENIO-NODO'::text,
        'Convenio Nodo'::text,
        'Bonificación del 100% sobre el subtotal. El servicio sigue activo.'::text,
        100.00::numeric
      )
  ) AS seed(code, name, description, discount_percent)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.isp_commercial_conditions existing
    WHERE existing.company_id = v_company
      AND existing.deleted_at IS NULL
      AND lower(existing.code) = lower(seed.code)
  );

  IF (
    SELECT count(*)
    FROM public.isp_commercial_components
    WHERE company_id = v_company
      AND deleted_at IS NULL
      AND code IN ('PACK-FUTBOL', 'IP-PUBLICA', 'TV-FULL-UPGRADE')
  ) <> 3 THEN
    RAISE EXCEPTION 'No quedaron los 3 componentes comerciales de ABNet.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.isp_commercial_conditions
    WHERE company_id = v_company
      AND deleted_at IS NULL
      AND code IN ('JUBILADO', 'CONVENIO-NODO')
  ) <> 2 THEN
    RAISE EXCEPTION 'No quedaron las condiciones comerciales de ABNet.';
  END IF;
END $$;
