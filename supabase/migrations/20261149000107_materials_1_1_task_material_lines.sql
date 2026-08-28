-- Materiales 1.1 — Líneas estructuradas de materiales por OT (sin reserva ni consumo).

CREATE TYPE public.task_material_line_status AS ENUM (
  'planned',
  'cancelled'
);

CREATE TABLE public.task_material_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials (id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  quantity_planned numeric(18, 4) NOT NULL,
  unit text NOT NULL,
  notes text,
  status public.task_material_line_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_material_lines_quantity_positive CHECK (quantity_planned > 0),
  CONSTRAINT task_material_lines_unit_not_blank CHECK (char_length(trim(unit)) > 0)
);

CREATE INDEX task_material_lines_company_task_idx
  ON public.task_material_lines (company_id, task_id);

CREATE INDEX task_material_lines_company_material_idx
  ON public.task_material_lines (company_id, material_id);

CREATE INDEX task_material_lines_company_warehouse_idx
  ON public.task_material_lines (company_id, warehouse_id);

COMMENT ON TABLE public.task_material_lines IS
  'Materiales estructurados planificados por OT. No modifica stock ni reservas (Materiales 1.1).';

CREATE TRIGGER task_material_lines_set_updated_at
  BEFORE UPDATE ON public.task_material_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_materials_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_task_material_line_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_company uuid;
  v_material_company uuid;
  v_warehouse_company uuid;
BEGIN
  SELECT company_id INTO v_task_company
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF v_task_company IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  IF v_task_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'TASK_COMPANY_MISMATCH';
  END IF;

  SELECT company_id INTO v_material_company
  FROM public.materials
  WHERE id = NEW.material_id;

  IF v_material_company IS NULL THEN
    RAISE EXCEPTION 'MATERIAL_NOT_FOUND';
  END IF;

  IF v_material_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'MATERIAL_COMPANY_MISMATCH';
  END IF;

  SELECT company_id INTO v_warehouse_company
  FROM public.warehouses
  WHERE id = NEW.warehouse_id;

  IF v_warehouse_company IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';
  END IF;

  IF v_warehouse_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'WAREHOUSE_COMPANY_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_material_lines_enforce_company_match
  BEFORE INSERT OR UPDATE ON public.task_material_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_material_line_company_match();

CREATE OR REPLACE FUNCTION public.auth_can_access_task_material_lines()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      public.auth_user_has_allowed_module('materials')
      OR public.auth_user_has_allowed_module('work_orders')
    )
    AND NOT public.auth_is_demo_platform_read_only();
$$;

COMMENT ON FUNCTION public.auth_can_access_task_material_lines() IS
  'Read/write task material lines when user has materials or work_orders module.';

CREATE OR REPLACE FUNCTION public.auth_can_read_task_material_lines()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_has_allowed_module('materials')
    OR public.auth_user_has_allowed_module('work_orders');
$$;

ALTER TABLE public.task_material_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_material_lines_select_policy
  ON public.task_material_lines
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_read_task_material_lines()
  );

CREATE POLICY task_material_lines_insert_policy
  ON public.task_material_lines
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_access_task_material_lines()
  );

CREATE POLICY task_material_lines_update_policy
  ON public.task_material_lines
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_access_task_material_lines()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_access_task_material_lines()
  );

CREATE POLICY task_material_lines_delete_policy
  ON public.task_material_lines
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_access_task_material_lines()
    AND status = 'planned'::public.task_material_line_status
  );
