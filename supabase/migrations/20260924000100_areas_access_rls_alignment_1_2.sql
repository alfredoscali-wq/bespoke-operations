-- Áreas y Accesos 1.2 — Alineación RLS focalizada
--
-- Extiende autorización backend usando JWT user_metadata.allowed_modules
-- sin duplicar module_visibility ni debilitar aislamiento multi-tenant.

CREATE OR REPLACE FUNCTION public.auth_user_allowed_modules()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' -> 'allowed_modules',
    '[]'::jsonb
  );
$$;

COMMENT ON FUNCTION public.auth_user_allowed_modules() IS
  'Allowed web module keys from JWT user_metadata.allowed_modules.';

CREATE OR REPLACE FUNCTION public.auth_user_has_allowed_module(p_module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_is_administrador()
    OR (
      p_module_key IS NOT NULL
      AND char_length(trim(p_module_key)) > 0
      AND public.auth_user_system_role() IS DISTINCT FROM 'operario'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(public.auth_user_allowed_modules()) AS module_key(value)
        WHERE module_key.value = trim(p_module_key)
      )
    );
$$;

COMMENT ON FUNCTION public.auth_user_has_allowed_module(text) IS
  'True when authenticated user may use a web module from JWT allowed_modules. Administrador bypass; Operario never gains module-based admin access.';

CREATE OR REPLACE FUNCTION public.auth_can_manage_incident_types()
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

COMMENT ON FUNCTION public.auth_can_manage_incident_types() IS
  'True when authenticated user may edit incident type configuration (Administrador, Técnica/supervisor, or settings module).';

CREATE OR REPLACE FUNCTION public.auth_can_manage_work_order_type_checklist()
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

COMMENT ON FUNCTION public.auth_can_manage_work_order_type_checklist() IS
  'True when authenticated user may edit work order type checklist templates (Administrador, Técnica/supervisor, or settings module).';

CREATE OR REPLACE FUNCTION public.auth_can_manage_task_incident(p_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_incidents ti
    WHERE ti.id = p_incident_id
      AND ti.company_id = public.auth_user_company_id()
      AND NOT public.auth_is_demo_platform_read_only()
      AND (
        public.auth_is_administrador()
        OR public.auth_is_supervisor_or_administrador()
        OR public.auth_user_has_allowed_module('planificacion')
        OR (
          public.auth_user_system_role() = 'operario'
          AND ti.employee_id = public.auth_user_employee_id()
        )
      )
  );
$$;

COMMENT ON FUNCTION public.auth_can_manage_task_incident(uuid) IS
  'Manage gate for task incident writes/events. Preserves Operario self-service; adds planificacion module for web planning.';

DROP POLICY IF EXISTS task_incidents_update_policy ON public.task_incidents;

CREATE POLICY task_incidents_update_policy
  ON public.task_incidents
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND (
      public.auth_is_administrador()
      OR public.auth_user_system_role() = 'supervisor'
      OR public.auth_user_has_allowed_module('planificacion')
    )
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND (
      public.auth_is_administrador()
      OR public.auth_user_system_role() = 'supervisor'
      OR public.auth_user_has_allowed_module('planificacion')
    )
    AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
  );

COMMENT ON POLICY task_incidents_update_policy ON public.task_incidents IS
  'Tenant-scoped incident updates for Administrador, Técnica/supervisor, or users with planificacion in allowed_modules.';
