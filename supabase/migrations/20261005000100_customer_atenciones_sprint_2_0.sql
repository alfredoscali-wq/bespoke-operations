-- Atención al Cliente 2.0 Sprint 2.0 — Consulta central: ciclo de vida, próximo paso, eventos, tenant integrity

ALTER TABLE public.customer_atenciones
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS active_management_employee_id uuid REFERENCES public.employees (id),
  ADD COLUMN IF NOT EXISTS active_management_started_at timestamptz;

COMMENT ON COLUMN public.customer_atenciones.status IS
  'Operational lifecycle state of the Consulta (company-owned case).';

COMMENT ON COLUMN public.customer_atenciones.next_step IS
  'Suggested next operational action; independent from status.';

COMMENT ON COLUMN public.customer_atenciones.active_management_employee_id IS
  'Employee currently working the Consulta (temporary, not permanent assignment).';

COMMENT ON COLUMN public.customer_atenciones.active_management_started_at IS
  'Timestamp when active management started.';

-- Backfill determinístico desde resultado histórico (Sprint 1.0 semantics).
UPDATE public.customer_atenciones
SET status = CASE
  WHEN resultado IN ('resuelta', 'ot_creada') THEN 'resuelta'
  WHEN resultado = 'requiere_seguimiento' THEN 'pendiente'
  ELSE 'resuelta'
END
WHERE status IS NULL;

UPDATE public.customer_atenciones
SET next_step = NULL
WHERE next_step IS NULL;

ALTER TABLE public.customer_atenciones
  ALTER COLUMN status SET DEFAULT 'nueva',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_status_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_status_check CHECK (
    status IN (
      'nueva',
      'para_resolver',
      'en_gestion',
      'pendiente',
      'resuelta'
    )
  );

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_next_step_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_next_step_check CHECK (
    next_step IS NULL
    OR next_step IN (
      'realizar_retencion',
      'resolver_facturacion',
      'analizar_problema_tecnico',
      'contactar_cliente',
      'esperar_cliente',
      'esperar_administracion',
      'coordinar_retiro',
      'generar_ot'
    )
  );

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_resuelta_next_step_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_resuelta_next_step_check CHECK (
    status <> 'resuelta'
    OR next_step IS NULL
  );

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_active_management_fields_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_active_management_fields_check CHECK (
    (
      active_management_employee_id IS NULL
      AND active_management_started_at IS NULL
    )
    OR (
      active_management_employee_id IS NOT NULL
      AND active_management_started_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS customer_atenciones_company_status_idx
  ON public.customer_atenciones (company_id, status);

CREATE OR REPLACE FUNCTION public.enforce_customer_atenciones_tenant_integrity()
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
    RAISE EXCEPTION 'CUSTOMER_ATENCION_CUSTOMER_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El cliente referenciado no pertenece al tenant de la consulta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.attended_by_employee_id
      AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_ATENCION_ATTENDED_EMPLOYEE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado que atendió no pertenece al tenant de la consulta.';
  END IF;

  IF NEW.active_management_employee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.employees e
       WHERE e.id = NEW.active_management_employee_id
         AND e.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'CUSTOMER_ATENCION_ACTIVE_MANAGEMENT_EMPLOYEE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado en gestión activa no pertenece al tenant de la consulta.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_customer_atenciones_tenant_integrity() IS
  'Rejects customer_atenciones rows whose FK targets belong to a different tenant.';

DROP TRIGGER IF EXISTS customer_atenciones_enforce_tenant_integrity
  ON public.customer_atenciones;

CREATE TRIGGER customer_atenciones_enforce_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.customer_atenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_atenciones_tenant_integrity();

CREATE TABLE IF NOT EXISTS public.customer_atencion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_atencion_id uuid NOT NULL REFERENCES public.customer_atenciones (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  action_type text NOT NULL,
  detail text,
  previous_status text,
  new_status text,
  previous_next_step text,
  new_next_step text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_atencion_events_action_type_check CHECK (
    action_type IN (
      'consulta_creada',
      'gestion_iniciada',
      'gestion_registrada',
      'consulta_pendiente',
      'consulta_resuelta',
      'proximo_paso_cambiado'
    )
  ),
  CONSTRAINT customer_atencion_events_previous_status_check CHECK (
    previous_status IS NULL
    OR previous_status IN (
      'nueva',
      'para_resolver',
      'en_gestion',
      'pendiente',
      'resuelta'
    )
  ),
  CONSTRAINT customer_atencion_events_new_status_check CHECK (
    new_status IS NULL
    OR new_status IN (
      'nueva',
      'para_resolver',
      'en_gestion',
      'pendiente',
      'resuelta'
    )
  ),
  CONSTRAINT customer_atencion_events_previous_next_step_check CHECK (
    previous_next_step IS NULL
    OR previous_next_step IN (
      'realizar_retencion',
      'resolver_facturacion',
      'analizar_problema_tecnico',
      'contactar_cliente',
      'esperar_cliente',
      'esperar_administracion',
      'coordinar_retiro',
      'generar_ot'
    )
  ),
  CONSTRAINT customer_atencion_events_new_next_step_check CHECK (
    new_next_step IS NULL
    OR new_next_step IN (
      'realizar_retencion',
      'resolver_facturacion',
      'analizar_problema_tecnico',
      'contactar_cliente',
      'esperar_cliente',
      'esperar_administracion',
      'coordinar_retiro',
      'generar_ot'
    )
  )
);

CREATE INDEX customer_atencion_events_company_atencion_created_idx
  ON public.customer_atencion_events (company_id, customer_atencion_id, created_at DESC);

COMMENT ON TABLE public.customer_atencion_events IS
  'Append-only action history for customer_atenciones (Consulta traceability).';

CREATE OR REPLACE FUNCTION public.enforce_customer_atencion_events_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_atenciones ca
    WHERE ca.id = NEW.customer_atencion_id
      AND ca.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_ATENCION_EVENT_ATENCION_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'La consulta referenciada no pertenece al tenant del evento.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.employee_id
      AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_ATENCION_EVENT_EMPLOYEE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El empleado actor no pertenece al tenant del evento.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_customer_atencion_events_tenant_integrity() IS
  'Rejects customer_atencion_events rows whose FK targets belong to a different tenant.';

DROP TRIGGER IF EXISTS customer_atencion_events_enforce_tenant_integrity
  ON public.customer_atencion_events;

CREATE TRIGGER customer_atencion_events_enforce_tenant_integrity
  BEFORE INSERT ON public.customer_atencion_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_atencion_events_tenant_integrity();

CREATE OR REPLACE FUNCTION public.customer_atenciones_record_consulta_creada_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_atencion_events (
    company_id,
    customer_atencion_id,
    employee_id,
    action_type,
    previous_status,
    new_status,
    previous_next_step,
    new_next_step,
    created_at
  ) VALUES (
    NEW.company_id,
    NEW.id,
    NEW.attended_by_employee_id,
    'consulta_creada',
    NULL,
    NEW.status,
    NULL,
    NEW.next_step,
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.customer_atenciones_record_consulta_creada_event() IS
  'Atomically records consulta_creada when a customer_atencion row is inserted.';

DROP TRIGGER IF EXISTS customer_atenciones_record_consulta_creada_event
  ON public.customer_atenciones;

CREATE TRIGGER customer_atenciones_record_consulta_creada_event
  AFTER INSERT ON public.customer_atenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_atenciones_record_consulta_creada_event();

ALTER TABLE public.customer_atencion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_atencion_events_select_policy
  ON public.customer_atencion_events
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
  );

CREATE POLICY customer_atencion_events_insert_policy
  ON public.customer_atencion_events
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
  );
