-- Atención al Cliente 2.0 — customer_seguimientos + follow-up chain

CREATE TABLE IF NOT EXISTS public.customer_seguimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  source_atencion_id uuid REFERENCES public.customer_atenciones (id),
  previous_seguimiento_id uuid REFERENCES public.customer_seguimientos (id),
  assigned_employee_id uuid NOT NULL REFERENCES public.employees (id),
  scheduled_date date NOT NULL,
  scheduled_time time,
  observation text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente',
  completion_action text,
  completed_at timestamptz,
  completed_by_employee_id uuid REFERENCES public.employees (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT customer_seguimientos_status_check CHECK (
    status IN ('pendiente', 'completado')
  )
);

CREATE INDEX customer_seguimientos_company_assigned_date_idx
  ON public.customer_seguimientos (company_id, assigned_employee_id, scheduled_date);

CREATE INDEX customer_seguimientos_company_assigned_status_idx
  ON public.customer_seguimientos (company_id, assigned_employee_id, status);

CREATE INDEX customer_seguimientos_company_source_atencion_idx
  ON public.customer_seguimientos (company_id, source_atencion_id);

CREATE OR REPLACE FUNCTION public.set_customer_seguimientos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_seguimientos_set_updated_at
  BEFORE UPDATE ON public.customer_seguimientos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_seguimientos_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_customer_seguimientos_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_SEGUIMIENTO_CUSTOMER_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El cliente referenciado no pertenece al tenant del seguimiento.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.assigned_employee_id
      AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_SEGUIMIENTO_ASSIGNED_EMPLOYEE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado asignado no pertenece al tenant del seguimiento.';
  END IF;

  IF NEW.completed_by_employee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.employees e
       WHERE e.id = NEW.completed_by_employee_id
         AND e.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'CUSTOMER_SEGUIMIENTO_COMPLETED_EMPLOYEE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado que completó la gestión no pertenece al tenant del seguimiento.';
  END IF;

  IF NEW.source_atencion_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.customer_atenciones ca
       WHERE ca.id = NEW.source_atencion_id
         AND ca.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'CUSTOMER_SEGUIMIENTO_SOURCE_ATENCION_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'La atención de origen no pertenece al tenant del seguimiento.';
  END IF;

  IF NEW.previous_seguimiento_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.customer_seguimientos cs
       WHERE cs.id = NEW.previous_seguimiento_id
         AND cs.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'CUSTOMER_SEGUIMIENTO_PREVIOUS_SEGUIMIENTO_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El seguimiento anterior no pertenece al tenant del seguimiento.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_customer_seguimientos_tenant_integrity() IS
  'Rejects customer_seguimientos rows whose FK targets belong to a different tenant.';

DROP TRIGGER IF EXISTS customer_seguimientos_enforce_tenant_integrity
  ON public.customer_seguimientos;

CREATE TRIGGER customer_seguimientos_enforce_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.customer_seguimientos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_seguimientos_tenant_integrity();

COMMENT ON TABLE public.customer_seguimientos IS
  'Scheduled customer follow-ups for Atención al Cliente.';

ALTER TABLE public.customer_seguimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_seguimientos_select_policy
  ON public.customer_seguimientos
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
  );

CREATE POLICY customer_seguimientos_insert_policy
  ON public.customer_seguimientos
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY customer_seguimientos_update_policy
  ON public.customer_seguimientos
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
  );
