-- Tesorería 2.1 — medio esperado (snapshot OT) vs medio realmente cobrado.
-- No modifica tasks.payment_method.

ALTER TABLE public.treasury_ot_renditions
  ADD COLUMN IF NOT EXISTS payment_method_expected text,
  ADD COLUMN IF NOT EXISTS payment_method_received text;

ALTER TABLE public.treasury_ot_renditions
  DROP CONSTRAINT IF EXISTS treasury_ot_renditions_payment_method_received_check;

ALTER TABLE public.treasury_ot_renditions
  ADD CONSTRAINT treasury_ot_renditions_payment_method_received_check CHECK (
    payment_method_received IS NULL
    OR payment_method_received IN (
      'efectivo',
      'transferencia',
      'debito',
      'credito',
      'mercadopago',
      'cheque',
      'otro',
      'tarjeta'
    )
  );

COMMENT ON COLUMN public.treasury_ot_renditions.payment_method_expected IS
  'Snapshot of tasks.payment_method at rendition creation. OT is not updated later.';

COMMENT ON COLUMN public.treasury_ot_renditions.payment_method_received IS
  'Payment method actually collected when Tesorería confirms the rendition.';

-- Snapshot expected method for existing rows (pending or already rendered).
UPDATE public.treasury_ot_renditions r
SET payment_method_expected = nullif(trim(t.payment_method), '')
FROM public.tasks t
WHERE r.task_id = t.id
  AND r.payment_method_expected IS NULL
  AND t.payment_method IS NOT NULL
  AND nullif(trim(t.payment_method), '') IS NOT NULL;

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
  v_payment_method text;
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
    coalesce(nullif(trim(t.crew), ''), ''),
    nullif(trim(t.payment_method), '')
  INTO
    v_company_id,
    v_amount,
    v_status,
    v_task_code,
    v_customer_id,
    v_customer_name,
    v_crew_id,
    v_crew_name,
    v_payment_method
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
    status,
    payment_method_expected
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
    'pendiente_rendicion',
    v_payment_method
  )
  RETURNING id INTO v_rendition_id;

  RETURN v_rendition_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_treasury_ot_rendition_for_task(uuid) IS
  'Idempotent: creates pendiente_rendicion when finalized OT has amount_to_collect > 0. Snapshots payment_method_expected from the OT.';
