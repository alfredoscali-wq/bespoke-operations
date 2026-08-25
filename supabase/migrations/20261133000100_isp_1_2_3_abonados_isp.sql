-- ISP 1.2.3 — Explicit ISP subscriber membership.
-- customers remains the general directory. Clientes 360° only lists isp_subscribers.
-- Does not modify, hide or delete existing /clientes records.

CREATE TABLE public.isp_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  source text NOT NULL DEFAULT 'onboarding'
    CHECK (source IN ('onboarding', 'migration', 'service')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT isp_subscribers_company_customer_unique UNIQUE (company_id, customer_id)
);

CREATE INDEX isp_subscribers_company_idx
  ON public.isp_subscribers (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX isp_subscribers_customer_idx
  ON public.isp_subscribers (customer_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.isp_subscribers IS
  'Explicit ISP universe membership. A general customers row is not an ISP subscriber until incorporated via 360 onboarding or confirmed ISP migration.';

CREATE TRIGGER isp_subscribers_set_updated_at
  BEFORE UPDATE ON public.isp_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_isp_subscriber_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_company uuid;
BEGIN
  SELECT company_id
    INTO v_customer_company
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_customer_company IS NULL THEN
    RAISE EXCEPTION 'El abonado ISP requiere un cliente existente.';
  END IF;

  IF v_customer_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'No se puede incorporar un cliente de otra empresa al universo ISP.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_subscribers_enforce_company
  BEFORE INSERT OR UPDATE ON public.isp_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_subscriber_company_match();

ALTER TABLE public.isp_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_subscribers_select_policy
  ON public.isp_subscribers
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('clientes_360')
      OR public.auth_can_manage_isp_migration()
    )
  );

CREATE POLICY isp_subscribers_insert_policy
  ON public.isp_subscribers
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_subscribers_update_policy
  ON public.isp_subscribers
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.isp_subscribers TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_isp_subscriber(
  p_company_id uuid,
  p_customer_id uuid,
  p_source text DEFAULT 'onboarding'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_company uuid;
  v_source text := COALESCE(NULLIF(btrim(p_source), ''), 'onboarding');
BEGIN
  IF p_company_id IS NULL OR p_customer_id IS NULL THEN
    RAISE EXCEPTION 'La pertenencia ISP requiere empresa y cliente.';
  END IF;

  IF v_source NOT IN ('onboarding', 'migration', 'service') THEN
    v_source := 'onboarding';
  END IF;

  SELECT company_id
    INTO v_customer_company
  FROM public.customers
  WHERE id = p_customer_id
    AND deleted_at IS NULL;

  IF v_customer_company IS NULL THEN
    RAISE EXCEPTION 'El abonado ISP requiere un cliente existente.';
  END IF;

  IF v_customer_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'No se puede incorporar un cliente de otra empresa al universo ISP.';
  END IF;

  INSERT INTO public.isp_subscribers (company_id, customer_id, source)
  VALUES (p_company_id, p_customer_id, v_source)
  ON CONFLICT (company_id, customer_id) DO UPDATE
    SET deleted_at = NULL,
        updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.ensure_isp_subscriber(uuid, uuid, text) IS
  'Idempotent ISP membership. Never infers membership from name, DNI, phone or address.';

GRANT EXECUTE ON FUNCTION public.ensure_isp_subscriber(uuid, uuid, text) TO authenticated;

INSERT INTO public.isp_subscribers (company_id, customer_id, source)
SELECT DISTINCT services.company_id, services.customer_id, 'service'
FROM public.isp_services services
INNER JOIN public.customers customers
  ON customers.id = services.customer_id
 AND customers.company_id = services.company_id
WHERE services.deleted_at IS NULL
  AND customers.deleted_at IS NULL
ON CONFLICT (company_id, customer_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.isp_services_ensure_subscriber()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    PERFORM public.ensure_isp_subscriber(NEW.company_id, NEW.customer_id, 'service');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_services_ensure_subscriber
  AFTER INSERT OR UPDATE OF company_id, customer_id, deleted_at
  ON public.isp_services
  FOR EACH ROW
  EXECUTE FUNCTION public.isp_services_ensure_subscriber();

ALTER FUNCTION public.create_isp_onboarding(jsonb)
  RENAME TO create_isp_onboarding_core;

CREATE OR REPLACE FUNCTION public.create_isp_onboarding(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_result jsonb;
  v_customer_id uuid;
BEGIN
  v_result := public.create_isp_onboarding_core(p_payload);

  IF COALESCE((v_result ->> 'requiresConfirmation')::boolean, false) THEN
    RETURN v_result;
  END IF;

  v_customer_id := NULLIF(v_result ->> 'customerId', '')::uuid;
  IF v_customer_id IS NOT NULL THEN
    PERFORM public.ensure_isp_subscriber(v_company_id, v_customer_id, 'onboarding');
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_isp_onboarding(jsonb) IS
  'Transactional ISP onboarding. Always records explicit isp_subscribers membership, including customer-only altas.';

GRANT EXECUTE ON FUNCTION public.create_isp_onboarding(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_isp_onboarding_core(jsonb) TO authenticated;

ALTER FUNCTION public.import_isp_migration(uuid, boolean)
  RENAME TO import_isp_migration_core;

CREATE OR REPLACE FUNCTION public.import_isp_migration(
  p_run_id uuid,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_result jsonb;
BEGIN
  v_result := public.import_isp_migration_core(p_run_id, p_force);

  INSERT INTO public.isp_subscribers (company_id, customer_id, source)
  SELECT DISTINCT v_company_id, customers.id, 'migration'
  FROM public.isp_migration_staging_rows staging
  INNER JOIN public.customers customers
    ON customers.company_id = v_company_id
   AND customers.deleted_at IS NULL
   AND lower(customers.external_customer_code)
     = lower(staging.payload ->> 'cliente_id_externo')
  WHERE staging.run_id = p_run_id
    AND staging.sheet = 'CLIENTES'
    AND staging.validation_status IN ('valid', 'warning')
  ON CONFLICT (company_id, customer_id) DO UPDATE
    SET deleted_at = NULL,
        updated_at = now();

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.import_isp_migration(uuid, boolean) IS
  'Confirmed ISP migration import. Example-only runs never call this function. Imported CLIENTES rows become isp_subscribers.';

GRANT EXECUTE ON FUNCTION public.import_isp_migration(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_isp_migration_core(uuid, boolean) TO authenticated;
