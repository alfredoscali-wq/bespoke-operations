-- Atención al Cliente 3.0 — customer_retenciones (operativo)

CREATE OR REPLACE FUNCTION public.auth_user_role_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cr.code
  FROM public.employees e
  JOIN public.company_roles cr
    ON cr.id = e.role_id
  WHERE e.app_user_id = auth.uid()
    AND e.deleted_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_user_role_code() IS
  'Company role code for the authenticated employee within the tenant.';

CREATE OR REPLACE FUNCTION public.auth_can_assign_customer_retencion()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.auth_user_role_code(), '') IN ('administrador', 'administracion');
$$;

COMMENT ON FUNCTION public.auth_can_assign_customer_retencion() IS
  'True when the authenticated user may assign customer retenciones.';

CREATE TABLE IF NOT EXISTS public.customer_retenciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  assigned_employee_id uuid NOT NULL REFERENCES public.employees (id),
  assigned_by_employee_id uuid NOT NULL REFERENCES public.employees (id),
  motivo_baja text NOT NULL,
  detail text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente',
  resultado text,
  resolution text,
  completed_at timestamptz,
  completed_by_employee_id uuid REFERENCES public.employees (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT customer_retenciones_status_check CHECK (
    status IN ('pendiente', 'finalizada')
  ),
  CONSTRAINT customer_retenciones_resultado_check CHECK (
    resultado IS NULL OR resultado IN ('retenido', 'no_retenido')
  ),
  CONSTRAINT customer_retenciones_motivo_baja_check CHECK (
    motivo_baja IN (
      'precio_situacion_economica',
      'problemas_tecnicos',
      'problemas_reiterados_sin_solucion',
      'mala_atencion',
      'falta_de_respuesta',
      'cambio_de_proveedor',
      'mudanza',
      'ya_no_necesita_servicio',
      'otro'
    )
  ),
  CONSTRAINT customer_retenciones_pending_fields_check CHECK (
    status <> 'pendiente'
    OR (
      resultado IS NULL
      AND resolution IS NULL
      AND completed_at IS NULL
      AND completed_by_employee_id IS NULL
    )
  ),
  CONSTRAINT customer_retenciones_finalizada_fields_check CHECK (
    status <> 'finalizada'
    OR (
      resultado IS NOT NULL
      AND resolution IS NOT NULL
      AND char_length(trim(resolution)) > 0
      AND completed_at IS NOT NULL
      AND completed_by_employee_id IS NOT NULL
    )
  )
);

CREATE INDEX customer_retenciones_company_assigned_status_idx
  ON public.customer_retenciones (company_id, assigned_employee_id, status);

CREATE INDEX customer_retenciones_company_created_idx
  ON public.customer_retenciones (company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_customer_retenciones_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_retenciones_set_updated_at
  BEFORE UPDATE ON public.customer_retenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_retenciones_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_customer_retenciones_tenant_integrity()
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
    RAISE EXCEPTION 'CUSTOMER_RETENCION_CUSTOMER_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El cliente referenciado no pertenece al tenant de la retención.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.company_roles cr
      ON cr.id = e.role_id
    WHERE e.id = NEW.assigned_employee_id
      AND e.company_id = NEW.company_id
      AND e.employment_status = 'active'
      AND cr.code = 'atencion_cliente'
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_ASSIGNED_EMPLOYEE_INVALID'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El responsable debe ser un empleado activo del área Atención al Cliente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.assigned_by_employee_id
      AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_ASSIGNED_BY_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado que asignó la retención no pertenece al tenant.';
  END IF;

  IF NEW.completed_by_employee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.employees e
       WHERE e.id = NEW.completed_by_employee_id
         AND e.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_COMPLETED_EMPLOYEE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado que finalizó la retención no pertenece al tenant.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_customer_retenciones_tenant_integrity() IS
  'Rejects customer_retenciones rows with cross-tenant or invalid assignee references.';

DROP TRIGGER IF EXISTS customer_retenciones_enforce_tenant_integrity
  ON public.customer_retenciones;

CREATE TRIGGER customer_retenciones_enforce_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.customer_retenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_retenciones_tenant_integrity();

CREATE OR REPLACE FUNCTION public.enforce_customer_retenciones_assignment_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_COMPANY_ID_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'company_id no puede modificarse tras la asignación.';
  END IF;

  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_CUSTOMER_ID_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'customer_id no puede modificarse tras la asignación.';
  END IF;

  IF NEW.assigned_employee_id IS DISTINCT FROM OLD.assigned_employee_id THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_ASSIGNED_EMPLOYEE_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'assigned_employee_id no puede modificarse tras la asignación.';
  END IF;

  IF NEW.assigned_by_employee_id IS DISTINCT FROM OLD.assigned_by_employee_id THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_ASSIGNED_BY_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'assigned_by_employee_id no puede modificarse tras la asignación.';
  END IF;

  IF NEW.motivo_baja IS DISTINCT FROM OLD.motivo_baja THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_MOTIVO_BAJA_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'motivo_baja no puede modificarse tras la asignación.';
  END IF;

  IF NEW.detail IS DISTINCT FROM OLD.detail THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_DETAIL_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'detail no puede modificarse tras la asignación.';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_CREATED_AT_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'created_at no puede modificarse tras la asignación.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_customer_retenciones_assignment_immutability() IS
  'Rejects updates that mutate assignment payload loaded by Administración.';

DROP TRIGGER IF EXISTS customer_retenciones_enforce_assignment_immutability
  ON public.customer_retenciones;

CREATE TRIGGER customer_retenciones_enforce_assignment_immutability
  BEFORE UPDATE ON public.customer_retenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_retenciones_assignment_immutability();

COMMENT ON TABLE public.customer_retenciones IS
  'Operational customer retention assignments for Atención al Cliente.';

ALTER TABLE public.customer_retenciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_retenciones_select_policy
  ON public.customer_retenciones
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
  );

CREATE POLICY customer_retenciones_insert_policy
  ON public.customer_retenciones
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND public.auth_can_assign_customer_retencion()
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY customer_retenciones_update_policy
  ON public.customer_retenciones
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND assigned_employee_id = public.auth_user_employee_id()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND assigned_employee_id = public.auth_user_employee_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );
