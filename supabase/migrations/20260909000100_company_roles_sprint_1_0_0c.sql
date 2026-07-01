-- Sprint 1.0.0C — Roles (module visibility per company)

CREATE TABLE IF NOT EXISTS public.company_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  module_visibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_roles_code_not_blank
    CHECK (char_length(trim(code)) > 0),
  CONSTRAINT company_roles_name_not_blank
    CHECK (char_length(trim(name)) > 0),
  CONSTRAINT company_roles_sort_order_positive
    CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS company_roles_company_code_unique
  ON public.company_roles (company_id, code);

CREATE INDEX IF NOT EXISTS company_roles_company_sort_idx
  ON public.company_roles (company_id, sort_order);

COMMENT ON TABLE public.company_roles IS
  'Tenant-configurable roles controlling module visibility in Bespoke Operations.';

COMMENT ON COLUMN public.company_roles.module_visibility IS
  'JSON map of module keys to visible=true/false.';

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.company_roles (id);

CREATE INDEX IF NOT EXISTS employees_role_id_idx
  ON public.employees (role_id);

CREATE OR REPLACE FUNCTION public.set_company_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_roles_set_updated_at ON public.company_roles;

CREATE TRIGGER company_roles_set_updated_at
  BEFORE UPDATE ON public.company_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_roles_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_manage_company_roles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'system_role') = 'administrador',
    false
  )
  AND NOT public.auth_is_demo_platform_read_only();
$$;

ALTER TABLE public.company_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_roles_select_policy
  ON public.company_roles
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

CREATE POLICY company_roles_insert_policy
  ON public.company_roles
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_company_roles()
  );

CREATE POLICY company_roles_update_policy
  ON public.company_roles
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_company_roles()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_company_roles()
  );

CREATE POLICY company_roles_delete_policy
  ON public.company_roles
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_company_roles()
    AND is_system = false
  );

-- Seed system roles per company and backfill employees.role_id
DO $$
DECLARE
  company record;
  role_admin uuid;
  role_supervisor uuid;
  role_administrativo uuid;
  role_rrhh uuid;
  role_operario uuid;
BEGIN
  FOR company IN SELECT id FROM public.companies LOOP
    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'administrador',
      'Administrador',
      true,
      '{"dashboard":true,"calendar":true,"projects":true,"work_orders":true,"planificacion":true,"customers":true,"crews":true,"materials":true,"evidence":true,"reports":true,"employees":true,"news":true,"settings":true,"history":true,"users":true,"dispositivos":true,"maintenance":true}'::jsonb,
      1
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO role_admin;

    IF role_admin IS NULL THEN
      SELECT id INTO role_admin
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'administrador';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'supervisor',
      'Supervisor',
      true,
      '{"dashboard":false,"calendar":true,"projects":true,"work_orders":true,"planificacion":true,"customers":true,"crews":false,"materials":false,"evidence":false,"reports":true,"employees":false,"news":false,"settings":true,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      2
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO role_supervisor;

    IF role_supervisor IS NULL THEN
      SELECT id INTO role_supervisor
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'supervisor';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'administrativo',
      'Administrativo',
      true,
      '{"dashboard":false,"calendar":true,"projects":true,"work_orders":true,"planificacion":false,"customers":true,"crews":false,"materials":false,"evidence":false,"reports":true,"employees":false,"news":false,"settings":false,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      3
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO role_administrativo;

    IF role_administrativo IS NULL THEN
      SELECT id INTO role_administrativo
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'administrativo';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'rrhh',
      'RRHH',
      true,
      '{"dashboard":true,"calendar":false,"projects":false,"work_orders":false,"planificacion":false,"customers":false,"crews":true,"materials":false,"evidence":false,"reports":false,"employees":true,"news":true,"settings":false,"history":false,"users":true,"dispositivos":false,"maintenance":false}'::jsonb,
      4
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO role_rrhh;

    IF role_rrhh IS NULL THEN
      SELECT id INTO role_rrhh
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'rrhh';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'operario',
      'Operario',
      true,
      '{"dashboard":false,"calendar":false,"projects":false,"work_orders":false,"planificacion":false,"customers":false,"crews":false,"materials":false,"evidence":false,"reports":false,"employees":false,"news":false,"settings":false,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      5
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO role_operario;

    IF role_operario IS NULL THEN
      SELECT id INTO role_operario
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'operario';
    END IF;

    UPDATE public.employees e
    SET role_id = CASE e.system_role
      WHEN 'administrador' THEN role_admin
      WHEN 'supervisor' THEN role_supervisor
      WHEN 'administrativo' THEN role_administrativo
      WHEN 'operario' THEN role_operario
      WHEN 'demo' THEN role_admin
      ELSE role_administrativo
    END
    WHERE e.company_id = company.id
      AND e.role_id IS NULL;
  END LOOP;
END $$;
