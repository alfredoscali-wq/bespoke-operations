-- Tesorería 2.0 — Pendientes de Rendición (OT cobrables → caja)
-- Separate from treasury_movements: pending cash from finalized OTs
-- only becomes an income movement when Administración confirms rendition.

CREATE TYPE public.treasury_ot_rendition_status AS ENUM (
  'pendiente_rendicion',
  'rendida',
  'cancelled'
);

CREATE TABLE public.treasury_ot_renditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  task_code text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  collection_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  crew_id uuid REFERENCES public.crews (id) ON DELETE SET NULL,
  crew_name text NOT NULL DEFAULT '',
  technician_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  technician_name text NOT NULL DEFAULT '',
  ot_finalized_at timestamptz NOT NULL DEFAULT now(),
  status public.treasury_ot_rendition_status NOT NULL DEFAULT 'pendiente_rendicion',
  delivered_by text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  treasury_movement_id uuid REFERENCES public.treasury_movements (id) ON DELETE SET NULL,
  confirmed_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  confirmed_by_name text NOT NULL DEFAULT '',
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treasury_ot_renditions_task_unique UNIQUE (task_id)
);

CREATE INDEX treasury_ot_renditions_company_status_idx
  ON public.treasury_ot_renditions (company_id, status);

CREATE INDEX treasury_ot_renditions_company_collection_date_idx
  ON public.treasury_ot_renditions (company_id, collection_date DESC);

CREATE OR REPLACE FUNCTION public.set_treasury_ot_renditions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER treasury_ot_renditions_set_updated_at
  BEFORE UPDATE ON public.treasury_ot_renditions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_treasury_ot_renditions_updated_at();

COMMENT ON TABLE public.treasury_ot_renditions IS
  'OT cash pending delivery to caja. Becomes treasury income only when rendida.';

ALTER TABLE public.treasury_ot_renditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY treasury_ot_renditions_select_policy
  ON public.treasury_ot_renditions
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_user_has_allowed_module('tesoreria')
      OR public.auth_user_has_allowed_module('tareas')
      OR public.auth_user_has_allowed_module('planificacion')
    )
  );

CREATE POLICY treasury_ot_renditions_update_policy
  ON public.treasury_ot_renditions
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() IN ('administrador', 'administrativo')
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- Auto-create on OT finalize: SECURITY DEFINER so supervisors can create
-- without tesoreria write permission.
CREATE OR REPLACE FUNCTION public.ensure_treasury_ot_rendition_for_task(
  p_task_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_amount numeric(14, 2);
  v_status text;
  v_task_code text;
  v_customer_id uuid;
  v_customer_name text;
  v_crew_id uuid;
  v_crew_name text;
  v_rendition_id uuid;
  v_auth_company uuid;
BEGIN
  v_auth_company := public.auth_user_company_id();
  IF v_auth_company IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT
    t.company_id,
    t.amount_to_collect,
    t.status::text,
    coalesce(nullif(trim(t.code), ''), nullif(trim(t.work_order_number), ''), t.id::text),
    t.customer_id,
    coalesce(nullif(trim(t.customer_name), ''), ''),
    t.crew_id,
    coalesce(nullif(trim(t.crew), ''), '')
  INTO
    v_company_id,
    v_amount,
    v_status,
    v_task_code,
    v_customer_id,
    v_customer_name,
    v_crew_id,
    v_crew_name
  FROM public.tasks t
  WHERE t.id = p_task_id
    AND t.deleted_at IS NULL;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  IF v_company_id <> v_auth_company THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF v_status IS DISTINCT FROM 'finalizada' THEN
    RETURN NULL;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_rendition_id
  FROM public.treasury_ot_renditions
  WHERE task_id = p_task_id;

  IF v_rendition_id IS NOT NULL THEN
    RETURN v_rendition_id;
  END IF;

  INSERT INTO public.treasury_ot_renditions (
    company_id,
    task_id,
    task_code,
    customer_id,
    customer_name,
    amount,
    collection_date,
    crew_id,
    crew_name,
    ot_finalized_at,
    status
  ) VALUES (
    v_company_id,
    p_task_id,
    v_task_code,
    v_customer_id,
    v_customer_name,
    v_amount,
    (timezone('utc', now()))::date,
    v_crew_id,
    v_crew_name,
    now(),
    'pendiente_rendicion'
  )
  RETURNING id INTO v_rendition_id;

  RETURN v_rendition_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_treasury_ot_rendition_for_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_treasury_ot_rendition_for_task(uuid) TO authenticated;

COMMENT ON FUNCTION public.ensure_treasury_ot_rendition_for_task(uuid) IS
  'Idempotent: creates pendiente_rendicion when finalized OT has amount_to_collect > 0.';
