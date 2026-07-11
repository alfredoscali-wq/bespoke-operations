-- Sprint RRHH 2.0 — Tipos de Empleados configurables (multi-tenant)

CREATE TABLE IF NOT EXISTS public.employee_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT employee_types_code_not_blank
    CHECK (char_length(trim(code)) > 0),
  CONSTRAINT employee_types_name_not_blank
    CHECK (char_length(trim(name)) > 0),
  CONSTRAINT employee_types_sort_order_non_negative
    CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_types_company_code_unique
  ON public.employee_types (company_id, lower(trim(code)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS employee_types_company_active_idx
  ON public.employee_types (company_id, is_active, sort_order)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.employee_types IS
  'Tenant-configurable employee type catalog for HR classification.';

COMMENT ON COLUMN public.employee_types.code IS
  'Stable technical identifier. Immutable after creation. Used for supervisor/cuadrilla logic.';

COMMENT ON COLUMN public.employee_types.name IS
  'Editable display label per tenant. Not used for business logic.';

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_type_id uuid REFERENCES public.employee_types (id);

CREATE INDEX IF NOT EXISTS employees_employee_type_id_idx
  ON public.employees (employee_type_id);

CREATE OR REPLACE FUNCTION public.set_employee_types_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_types_set_updated_at ON public.employee_types;

CREATE TRIGGER employee_types_set_updated_at
  BEFORE UPDATE ON public.employee_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employee_types_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_employee_types_code_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'EMPLOYEE_TYPE_CODE_IMMUTABLE'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El código del tipo de empleado no puede modificarse.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_types_prevent_code_change ON public.employee_types;

CREATE TRIGGER employee_types_prevent_code_change
  BEFORE UPDATE ON public.employee_types
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_types_code_change();

CREATE OR REPLACE FUNCTION public.enforce_employees_employee_type_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_type_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.employee_types et
       WHERE et.id = NEW.employee_type_id
         AND et.company_id = NEW.company_id
         AND et.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'EMPLOYEE_TYPE_TENANT_MISMATCH'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'El tipo de empleado referenciado no pertenece al tenant del empleado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_enforce_employee_type_tenant_integrity
  ON public.employees;

CREATE TRIGGER employees_enforce_employee_type_tenant_integrity
  BEFORE INSERT OR UPDATE OF employee_type_id, company_id
  ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employees_employee_type_tenant_integrity();

CREATE OR REPLACE FUNCTION public.auth_can_manage_employee_types()
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

COMMENT ON FUNCTION public.auth_can_manage_employee_types() IS
  'True when authenticated user may edit employee type configuration (Administrador, Técnica/supervisor, or settings module).';

ALTER TABLE public.employee_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_types_select_policy
  ON public.employee_types
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND deleted_at IS NULL
  );

CREATE POLICY employee_types_insert_policy
  ON public.employee_types
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_employee_types()
  );

CREATE POLICY employee_types_update_policy
  ON public.employee_types
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_employee_types()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_employee_types()
  );

CREATE OR REPLACE FUNCTION public.seed_company_employee_types(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_sort integer;
BEGIN
  SELECT COALESCE(MAX(sort_order), 0)
  INTO next_sort
  FROM public.employee_types
  WHERE company_id = p_company_id
    AND deleted_at IS NULL;

  INSERT INTO public.employee_types (
    company_id,
    code,
    name,
    description,
    is_active,
    sort_order
  )
  SELECT
    p_company_id,
    seed.code,
    seed.name,
    seed.description,
    true,
    next_sort + seed.relative_order
  FROM (
    VALUES
      (1, 'supervisor', 'Supervisor', 'Supervisión de cuadrillas y operaciones de campo.'),
      (2, 'administrative', 'Administrativo', 'Personal administrativo y de oficina.'),
      (3, 'operator', 'Operario', 'Personal operativo de campo.')
  ) AS seed (relative_order, code, name, description)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.employee_types existing
    WHERE existing.company_id = p_company_id
      AND lower(trim(existing.code)) = seed.code
      AND existing.deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.seed_company_employee_types(uuid) IS
  'Idempotently seeds standard employee types (supervisor, administrative, operator) for a company.';

-- Seed standard catalog for every active company
DO $$
DECLARE
  company record;
BEGIN
  FOR company IN
    SELECT id
    FROM public.companies
    WHERE deleted_at IS NULL
  LOOP
    PERFORM public.seed_company_employee_types(company.id);
  END LOOP;
END;
$$;

-- Seed legacy types (manager/other) only when employees still use those enum values
INSERT INTO public.employee_types (
  company_id,
  code,
  name,
  description,
  is_active,
  sort_order
)
SELECT
  needs.company_id,
  needs.code,
  needs.name,
  needs.description,
  true,
  needs.next_sort + needs.relative_order
FROM (
  SELECT
    e.company_id,
    legacy.code,
    legacy.name,
    legacy.description,
    legacy.relative_order,
    COALESCE(
      (
        SELECT MAX(et.sort_order)
        FROM public.employee_types et
        WHERE et.company_id = e.company_id
          AND et.deleted_at IS NULL
      ),
      0
    ) AS next_sort
  FROM public.employees e
  CROSS JOIN (
    VALUES
      ('manager', 'Gerente', 'Tipo legacy para empleados clasificados como gerente.', 1),
      ('other', 'Otro', 'Tipo legacy para empleados sin clasificación estándar.', 2)
  ) AS legacy (code, name, description, relative_order)
  WHERE e.deleted_at IS NULL
    AND (
      (legacy.code = 'manager' AND e.employee_type = 'gerente')
      OR (legacy.code = 'other' AND e.employee_type = 'otro')
    )
  GROUP BY
    e.company_id,
    legacy.code,
    legacy.name,
    legacy.description,
    legacy.relative_order
) AS needs
WHERE NOT EXISTS (
  SELECT 1
  FROM public.employee_types existing
  WHERE existing.company_id = needs.company_id
    AND lower(trim(existing.code)) = needs.code
    AND existing.deleted_at IS NULL
);

-- Backfill employees.employee_type_id from legacy enum
UPDATE public.employees e
SET employee_type_id = et.id
FROM public.employee_types et
WHERE e.employee_type_id IS NULL
  AND e.deleted_at IS NULL
  AND et.company_id = e.company_id
  AND et.deleted_at IS NULL
  AND lower(trim(et.code)) = CASE e.employee_type
    WHEN 'operario' THEN 'operator'
    WHEN 'supervisor' THEN 'supervisor'
    WHEN 'administrativo' THEN 'administrative'
    WHEN 'gerente' THEN 'manager'
    WHEN 'otro' THEN 'other'
    ELSE NULL
  END;
