-- Atención al Cliente 6.0 — flujo real de bajas y retenciones

ALTER TABLE public.customer_retenciones
  ADD COLUMN IF NOT EXISTS administration_pending_at timestamptz;

COMMENT ON COLUMN public.customer_retenciones.administration_pending_at IS
  'Timestamp when Atención al Cliente derived the case to Administración (persiste_baja).';

UPDATE public.customer_retenciones
SET status = 'en_gestion'
WHERE status = 'pendiente';

ALTER TABLE public.customer_retenciones
  DROP CONSTRAINT IF EXISTS customer_retenciones_status_check;

ALTER TABLE public.customer_retenciones
  DROP CONSTRAINT IF EXISTS customer_retenciones_resultado_check;

ALTER TABLE public.customer_retenciones
  DROP CONSTRAINT IF EXISTS customer_retenciones_pending_fields_check;

ALTER TABLE public.customer_retenciones
  DROP CONSTRAINT IF EXISTS customer_retenciones_finalizada_fields_check;

ALTER TABLE public.customer_retenciones
  ADD CONSTRAINT customer_retenciones_status_check CHECK (
    status IN (
      'en_gestion',
      'pendiente_administracion',
      'pendiente_retiro',
      'finalizada'
    )
  );

ALTER TABLE public.customer_retenciones
  ADD CONSTRAINT customer_retenciones_resultado_check CHECK (
    resultado IS NULL
    OR resultado IN ('retenido', 'persiste_baja', 'no_retenido')
  );

ALTER TABLE public.customer_retenciones
  ADD CONSTRAINT customer_retenciones_en_gestion_fields_check CHECK (
    status <> 'en_gestion'
    OR (
      resultado IS NULL
      AND resolution IS NULL
      AND completed_at IS NULL
      AND completed_by_employee_id IS NULL
      AND administration_pending_at IS NULL
    )
  );

ALTER TABLE public.customer_retenciones
  ADD CONSTRAINT customer_retenciones_pendiente_administracion_fields_check CHECK (
    status <> 'pendiente_administracion'
    OR (
      resultado = 'persiste_baja'
      AND resolution IS NOT NULL
      AND char_length(trim(resolution)) > 0
      AND completed_at IS NULL
      AND completed_by_employee_id IS NULL
      AND administration_pending_at IS NOT NULL
    )
  );

ALTER TABLE public.customer_retenciones
  ADD CONSTRAINT customer_retenciones_pendiente_retiro_fields_check CHECK (
    status <> 'pendiente_retiro'
    OR (
      resultado = 'persiste_baja'
      AND resolution IS NOT NULL
      AND char_length(trim(resolution)) > 0
      AND completed_at IS NULL
      AND completed_by_employee_id IS NULL
      AND administration_pending_at IS NOT NULL
    )
  );

ALTER TABLE public.customer_retenciones
  ADD CONSTRAINT customer_retenciones_finalizada_fields_check CHECK (
    status <> 'finalizada'
    OR (
      resultado IS NOT NULL
      AND resolution IS NOT NULL
      AND char_length(trim(resolution)) > 0
      AND completed_at IS NOT NULL
      AND completed_by_employee_id IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.auth_can_create_customer_retencion()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_employee_id() IS NOT NULL
    AND public.auth_user_has_allowed_module('atencion_cliente');
$$;

COMMENT ON FUNCTION public.auth_can_create_customer_retencion() IS
  'True when the authenticated user may start a customer baja/retención gestión.';

CREATE OR REPLACE FUNCTION public.enforce_customer_retenciones_workflow_transitions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.resultado IS NOT DISTINCT FROM OLD.resultado
     AND NEW.resolution IS NOT DISTINCT FROM OLD.resolution
     AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at
     AND NEW.completed_by_employee_id IS NOT DISTINCT FROM OLD.completed_by_employee_id
     AND NEW.administration_pending_at IS NOT DISTINCT FROM OLD.administration_pending_at THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'en_gestion' THEN
    IF NEW.status = 'finalizada' AND NEW.resultado = 'retenido' THEN
      IF NEW.completed_at IS NULL OR NEW.completed_by_employee_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_RETENCION_RETAINED_REQUIRES_COMPLETION'
          USING ERRCODE = 'check_violation',
                MESSAGE = 'Retener al cliente exige fecha y responsable de cierre.';
      END IF;

      IF NEW.resolution IS NULL OR char_length(trim(NEW.resolution)) = 0 THEN
        RAISE EXCEPTION 'CUSTOMER_RETENCION_RETAINED_REQUIRES_RESOLUTION'
          USING ERRCODE = 'check_violation',
                MESSAGE = 'Retener al cliente exige una resolución.';
      END IF;

      IF NEW.administration_pending_at IS NOT NULL THEN
        RAISE EXCEPTION 'CUSTOMER_RETENCION_RETAINED_INVALID_ADMIN_PENDING'
          USING ERRCODE = 'check_violation',
                MESSAGE = 'Un cierre retenido no puede conservar derivación a Administración.';
      END IF;

      RETURN NEW;
    END IF;

    IF NEW.status = 'pendiente_administracion' AND NEW.resultado = 'persiste_baja' THEN
      IF NEW.resolution IS NULL OR char_length(trim(NEW.resolution)) = 0 THEN
        RAISE EXCEPTION 'CUSTOMER_RETENCION_PERSISTE_REQUIRES_RESOLUTION'
          USING ERRCODE = 'check_violation',
                MESSAGE = 'Persiste con la baja exige una resolución.';
      END IF;

      IF NEW.completed_at IS NOT NULL OR NEW.completed_by_employee_id IS NOT NULL THEN
        RAISE EXCEPTION 'CUSTOMER_RETENCION_PERSISTE_FORBIDS_COMPLETION'
          USING ERRCODE = 'check_violation',
                MESSAGE = 'Persiste con la baja no puede cerrar la gestión.';
      END IF;

      IF NEW.administration_pending_at IS NULL THEN
        NEW.administration_pending_at = now();
      END IF;

      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'CUSTOMER_RETENCION_INVALID_EN_GESTION_TRANSITION'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Transición inválida desde en_gestion.';
  END IF;

  IF OLD.status = 'pendiente_administracion' AND NEW.status = 'pendiente_retiro' THEN
    IF NOT public.auth_can_assign_customer_retencion() THEN
      RAISE EXCEPTION 'CUSTOMER_RETENCION_ADMIN_TRANSITION_FORBIDDEN'
        USING ERRCODE = '42501',
              MESSAGE = 'Solo Administración puede marcar listo para retiro.';
    END IF;

    IF NEW.resultado IS DISTINCT FROM OLD.resultado
       OR NEW.resolution IS DISTINCT FROM OLD.resolution
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.completed_by_employee_id IS DISTINCT FROM OLD.completed_by_employee_id
       OR NEW.administration_pending_at IS DISTINCT FROM OLD.administration_pending_at THEN
      RAISE EXCEPTION 'CUSTOMER_RETENCION_ADMIN_TRANSITION_IMMUTABLE'
        USING ERRCODE = 'check_violation',
              MESSAGE = 'Marcar listo para retiro no puede modificar la gestión previa.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'pendiente_retiro' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'finalizada' THEN
    RAISE EXCEPTION 'CUSTOMER_RETENCION_FINALIZED_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Las gestiones finalizadas no pueden modificarse.';
  END IF;

  RAISE EXCEPTION 'CUSTOMER_RETENCION_INVALID_TRANSITION'
    USING ERRCODE = 'check_violation',
          MESSAGE = 'Transición de estado inválida para la gestión de baja.';
END;
$$;

COMMENT ON FUNCTION public.enforce_customer_retenciones_workflow_transitions() IS
  'Validates allowed customer_retenciones workflow transitions for AC and Administración.';

DROP TRIGGER IF EXISTS customer_retenciones_enforce_workflow_transitions
  ON public.customer_retenciones;

CREATE TRIGGER customer_retenciones_enforce_workflow_transitions
  BEFORE UPDATE ON public.customer_retenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_retenciones_workflow_transitions();

DROP POLICY IF EXISTS customer_retenciones_insert_policy ON public.customer_retenciones;

CREATE POLICY customer_retenciones_insert_policy
  ON public.customer_retenciones
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND public.auth_can_create_customer_retencion()
    AND assigned_employee_id = public.auth_user_employee_id()
    AND assigned_by_employee_id = public.auth_user_employee_id()
    AND status = 'en_gestion'
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS customer_retenciones_update_policy ON public.customer_retenciones;

CREATE POLICY customer_retenciones_update_policy
  ON public.customer_retenciones
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND assigned_employee_id = public.auth_user_employee_id()
    AND status = 'en_gestion'
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND assigned_employee_id = public.auth_user_employee_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS customer_retenciones_admin_update_policy
  ON public.customer_retenciones;

CREATE POLICY customer_retenciones_admin_update_policy
  ON public.customer_retenciones
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND public.auth_can_assign_customer_retencion()
    AND status = 'pendiente_administracion'
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND public.auth_can_assign_customer_retencion()
    AND status = 'pendiente_retiro'
    AND NOT public.auth_is_demo_platform_read_only()
  );

COMMENT ON TABLE public.customer_retenciones IS
  'Operational customer baja/retención workflow for Atención al Cliente and Administración.';
