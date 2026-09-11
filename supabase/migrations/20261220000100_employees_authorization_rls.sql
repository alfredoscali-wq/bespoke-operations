-- Sprint 7.7 — employees row authorization + privileged-column trigger.
-- Closes PostgREST privilege escalation (role_id / system_role / system_access /
-- must_change_password / app_user_id) without moving RRHH ficha to service_role.
-- SELECT unchanged. No DELETE policy (physical delete remains blocked for JWT).

-- Who may INSERT/UPDATE an employees row (ficha HR): administrator JWT or
-- JWT allowed_modules includes 'employees'. Operario never qualifies
-- (auth_user_has_allowed_module excludes operario). Demo remains blocked.

CREATE OR REPLACE FUNCTION public.auth_can_manage_employee_directory()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.auth_is_administrador()
    OR public.auth_user_has_allowed_module('employees');
$$;

COMMENT ON FUNCTION public.auth_can_manage_employee_directory() IS
  'True when the JWT may mutate employees directory rows (administrador or employees module). Does not grant privileged Auth columns.';

REVOKE ALL ON FUNCTION public.auth_can_manage_employee_directory() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_can_manage_employee_directory() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_can_manage_employee_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_can_manage_employee_directory() TO service_role;

DROP POLICY IF EXISTS employees_insert_policy ON public.employees;
CREATE POLICY employees_insert_policy
  ON public.employees
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_can_manage_employee_directory()
  );

COMMENT ON POLICY employees_insert_policy ON public.employees IS
  'Tenant + not demo + administrator or employees module. Privileged columns are enforced by trigger.';

DROP POLICY IF EXISTS employees_update_policy ON public.employees;
CREATE POLICY employees_update_policy
  ON public.employees
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_can_manage_employee_directory()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_can_manage_employee_directory()
    AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
  );

COMMENT ON POLICY employees_update_policy ON public.employees IS
  'Tenant + not demo + administrator or employees module. Soft-delete allowed; privileged columns enforced by trigger.';

-- Column authorization: fail-closed. service_role skipped (Auth lifecycle).
-- Non-admin JWT cannot write privileged Auth/identity columns.
-- INSERT non-admin: only safe defaults (operario, no access, no Auth link).

CREATE OR REPLACE FUNCTION public.enforce_employees_authorization_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.auth_is_administrador() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role_id IS NOT NULL THEN
      RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
        USING ERRCODE = 'insufficient_privilege',
              MESSAGE = 'No tiene permiso para asignar role_id al crear un empleado.';
    END IF;

    IF NEW.system_role IS DISTINCT FROM 'operario'::public.system_role THEN
      RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
        USING ERRCODE = 'insufficient_privilege',
              MESSAGE = 'No tiene permiso para asignar system_role al crear un empleado.';
    END IF;

    IF NEW.system_access IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
        USING ERRCODE = 'insufficient_privilege',
              MESSAGE = 'No tiene permiso para asignar system_access al crear un empleado.';
    END IF;

    IF NEW.must_change_password IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
        USING ERRCODE = 'insufficient_privilege',
              MESSAGE = 'No tiene permiso para asignar must_change_password al crear un empleado.';
    END IF;

    IF NEW.app_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
        USING ERRCODE = 'insufficient_privilege',
              MESSAGE = 'No tiene permiso para asignar app_user_id al crear un empleado.';
    END IF;

    IF NEW.company_id IS DISTINCT FROM public.auth_user_company_id() THEN
      RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
        USING ERRCODE = 'insufficient_privilege',
              MESSAGE = 'No tiene permiso para asignar company_id de otro tenant.';
    END IF;

    IF NEW.last_login_at IS NOT NULL THEN
      RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
        USING ERRCODE = 'insufficient_privilege',
              MESSAGE = 'No tiene permiso para asignar last_login_at al crear un empleado.';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'No tiene permiso para modificar role_id.';
  END IF;

  IF NEW.system_role IS DISTINCT FROM OLD.system_role THEN
    RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'No tiene permiso para modificar system_role.';
  END IF;

  IF NEW.system_access IS DISTINCT FROM OLD.system_access THEN
    RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'No tiene permiso para modificar system_access.';
  END IF;

  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'No tiene permiso para modificar must_change_password.';
  END IF;

  IF NEW.app_user_id IS DISTINCT FROM OLD.app_user_id THEN
    RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'No tiene permiso para modificar app_user_id.';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'No tiene permiso para modificar company_id.';
  END IF;

  IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at THEN
    RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'
      USING ERRCODE = 'insufficient_privilege',
            MESSAGE = 'No tiene permiso para modificar last_login_at.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_employees_authorization_columns() IS
  'BEFORE INSERT/UPDATE: service_role and JWT administrador may write privileged Auth columns; other JWTs are fail-closed. SECURITY INVOKER — uses auth.role() and auth_is_administrador().';

REVOKE ALL ON FUNCTION public.enforce_employees_authorization_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_employees_authorization_columns() FROM anon;
GRANT EXECUTE ON FUNCTION public.enforce_employees_authorization_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_employees_authorization_columns() TO service_role;

DROP TRIGGER IF EXISTS employees_enforce_authorization_columns ON public.employees;

CREATE TRIGGER employees_enforce_authorization_columns
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employees_authorization_columns();
