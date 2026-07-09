-- Atención al Cliente 5.0 — customer_recuperaciones (Recupero de Clientes)

CREATE TABLE IF NOT EXISTS public.customer_recuperaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid REFERENCES public.customers (id),
  manual_customer_name text,
  manual_zone text,
  manual_phone text,
  performed_by_employee_id uuid NOT NULL REFERENCES public.employees (id),
  channel text NOT NULL,
  offer text NOT NULL,
  observation text NOT NULL,
  resultado text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT customer_recuperaciones_channel_check CHECK (
    channel IN ('telefono', 'whatsapp', 'otro')
  ),
  CONSTRAINT customer_recuperaciones_resultado_check CHECK (
    resultado IN (
      'recuperado',
      'interesado',
      'no_interesado',
      'no_responde',
      'volver_a_contactar'
    )
  ),
  CONSTRAINT customer_recuperaciones_customer_mode_check CHECK (
    (
      customer_id IS NOT NULL
      AND manual_customer_name IS NULL
      AND manual_zone IS NULL
      AND manual_phone IS NULL
    )
    OR (
      customer_id IS NULL
      AND manual_customer_name IS NOT NULL
      AND manual_zone IS NOT NULL
      AND manual_phone IS NOT NULL
      AND char_length(trim(manual_customer_name)) > 0
      AND char_length(trim(manual_zone)) > 0
      AND char_length(trim(manual_phone)) > 0
    )
  ),
  CONSTRAINT customer_recuperaciones_offer_check CHECK (
    char_length(trim(offer)) > 0
  ),
  CONSTRAINT customer_recuperaciones_observation_check CHECK (
    char_length(trim(observation)) > 0
  )
);

CREATE INDEX customer_recuperaciones_company_performed_created_idx
  ON public.customer_recuperaciones (company_id, performed_by_employee_id, created_at DESC);

CREATE INDEX customer_recuperaciones_company_created_idx
  ON public.customer_recuperaciones (company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_customer_recuperaciones_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_recuperaciones_set_updated_at
  BEFORE UPDATE ON public.customer_recuperaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_recuperaciones_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_customer_recuperaciones_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.customers c
       WHERE c.id = NEW.customer_id
         AND c.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'CUSTOMER_RECUPERACION_CUSTOMER_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El cliente referenciado no pertenece al tenant de la recuperación.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.performed_by_employee_id
      AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_RECUPERACION_EMPLOYEE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado que realizó la recuperación no pertenece al tenant.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_customer_recuperaciones_tenant_integrity() IS
  'Rejects customer_recuperaciones rows with cross-tenant references.';

DROP TRIGGER IF EXISTS customer_recuperaciones_enforce_tenant_integrity
  ON public.customer_recuperaciones;

CREATE TRIGGER customer_recuperaciones_enforce_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.customer_recuperaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_recuperaciones_tenant_integrity();

COMMENT ON TABLE public.customer_recuperaciones IS
  'Customer recovery outreach attempts recorded by Atención al Cliente.';

ALTER TABLE public.customer_recuperaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_recuperaciones_select_policy
  ON public.customer_recuperaciones
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
  );

CREATE POLICY customer_recuperaciones_insert_policy
  ON public.customer_recuperaciones
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
    AND performed_by_employee_id = public.auth_user_employee_id()
  );
