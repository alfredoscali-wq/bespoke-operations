-- Sprint 1.0.0A — Checklist Operativo por Tipo de OT (multi-tenant)

CREATE TABLE IF NOT EXISTS public.work_order_type_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  service_type text NOT NULL,
  title text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_order_type_checklist_items_title_not_blank
    CHECK (char_length(trim(title)) > 0),
  CONSTRAINT work_order_type_checklist_items_sort_order_positive
    CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS work_order_type_checklist_items_order_unique
  ON public.work_order_type_checklist_items (company_id, service_type, sort_order);

CREATE INDEX IF NOT EXISTS work_order_type_checklist_items_lookup_idx
  ON public.work_order_type_checklist_items (company_id, service_type, sort_order);

COMMENT ON TABLE public.work_order_type_checklist_items IS
  'Operational checklist template items configured per work order service type and tenant.';

COMMENT ON COLUMN public.work_order_type_checklist_items.service_type IS
  'Work order service type code (e.g. instalacion-nueva). Matches tasks.service_type.';

CREATE OR REPLACE FUNCTION public.set_work_order_type_checklist_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_order_type_checklist_items_set_updated_at
  ON public.work_order_type_checklist_items;

CREATE TRIGGER work_order_type_checklist_items_set_updated_at
  BEFORE UPDATE ON public.work_order_type_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_work_order_type_checklist_items_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_manage_work_order_type_checklist()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'system_role') IN ('administrador', 'supervisor'),
    false
  )
  AND NOT public.auth_is_demo_platform_read_only();
$$;

COMMENT ON FUNCTION public.auth_can_manage_work_order_type_checklist() IS
  'True when the authenticated user may edit operational checklist templates.';

CREATE OR REPLACE FUNCTION public.auth_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.company_id
  FROM public.employees e
  WHERE e.app_user_id = auth.uid()
    AND e.deleted_at IS NULL
  LIMIT 1;
$$;

ALTER TABLE public.work_order_type_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_order_type_checklist_items_select_policy
  ON public.work_order_type_checklist_items
  FOR SELECT
  USING (company_id = public.auth_user_company_id());

CREATE POLICY work_order_type_checklist_items_insert_policy
  ON public.work_order_type_checklist_items
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_work_order_type_checklist()
  );

CREATE POLICY work_order_type_checklist_items_update_policy
  ON public.work_order_type_checklist_items
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_work_order_type_checklist()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_work_order_type_checklist()
  );

CREATE POLICY work_order_type_checklist_items_delete_policy
  ON public.work_order_type_checklist_items
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_work_order_type_checklist()
  );
