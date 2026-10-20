-- Commercial reference for ABNet subscribers from clientes.xlsx.
-- One row per customer number. It does not create customers, isp_services,
-- isp_connections, PPPoE credentials or provisions.
-- A later import updates the same number and keeps numbers absent from the file.
-- Empty incoming values do not erase a value already stored.

CREATE TABLE IF NOT EXISTS public.abnet_customer_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  abnet_customer_number text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  document_number text NOT NULL DEFAULT '',
  document_type text NOT NULL DEFAULT '',
  document_review boolean NOT NULL DEFAULT false,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  commercial_status text NOT NULL DEFAULT '',
  person_type text NOT NULL DEFAULT '',
  tax_condition text NOT NULL DEFAULT '',
  abnet_client_id text NOT NULL DEFAULT '',
  source_balance text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  review_required boolean NOT NULL DEFAULT false,
  review_reason text NOT NULL DEFAULT '',
  source_name text NOT NULL,
  import_batch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT abnet_customer_registry_company_number_uidx
    UNIQUE (company_id, abnet_customer_number)
);

COMMENT ON TABLE public.abnet_customer_registry IS
  'Imported ABNet personal reference keyed by customer number. Not a Bespoke customer and not a technical service.';

ALTER TABLE public.abnet_customer_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'abnet_customer_registry'
      AND policyname = 'abnet_customer_registry_select_policy'
  ) THEN
    CREATE POLICY abnet_customer_registry_select_policy
      ON public.abnet_customer_registry
      FOR SELECT
      USING (
        company_id = public.auth_user_company_id()
        AND (
          public.auth_user_has_allowed_module('subscriptions')
          OR public.auth_user_has_allowed_module('clientes_360')
        )
      );
  END IF;
END $$;

GRANT SELECT ON public.abnet_customer_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abnet_customer_registry TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_abnet_customer_registry(
  p_company_id uuid,
  p_source_name text,
  p_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_created integer := 0;
  v_updated integer := 0;
BEGIN
  IF p_company_id IS NULL OR btrim(coalesce(p_source_name, '')) = '' THEN
    RAISE EXCEPTION 'importacion invalida';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'importacion invalida';
  END IF;
  v_count := jsonb_array_length(p_rows);
  IF v_count < 1 OR v_count > 20000 THEN
    RAISE EXCEPTION 'cantidad de clientes invalida';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS item
    WHERE btrim(coalesce(item->>'abnet_customer_number', '')) = ''
      OR btrim(item->>'abnet_customer_number') !~ '^[0-9]+$'
      OR btrim(item->>'abnet_customer_number') = '0'
      OR btrim(item->>'abnet_customer_number') = '99999999'
  ) THEN
    RAISE EXCEPTION 'numero de cliente invalido';
  END IF;
  IF EXISTS (
    SELECT item->>'abnet_customer_number'
    FROM jsonb_array_elements(p_rows) AS item
    GROUP BY item->>'abnet_customer_number'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'numero repetido';
  END IF;

  WITH incoming AS (
    SELECT
      btrim(item->>'abnet_customer_number') AS abnet_customer_number,
      coalesce(item->>'customer_name', '') AS customer_name,
      coalesce(item->>'document_number', '') AS document_number,
      coalesce(item->>'document_type', '') AS document_type,
      coalesce((item->>'document_review')::boolean, false) AS document_review,
      coalesce(item->>'email', '') AS email,
      coalesce(item->>'phone', '') AS phone,
      coalesce(item->>'address', '') AS address,
      coalesce(item->>'city', '') AS city,
      coalesce(item->>'province', '') AS province,
      coalesce(item->>'commercial_status', '') AS commercial_status,
      coalesce(item->>'person_type', '') AS person_type,
      coalesce(item->>'tax_condition', '') AS tax_condition,
      coalesce(item->>'abnet_client_id', '') AS abnet_client_id,
      coalesce(item->>'source_balance', '') AS source_balance,
      coalesce(item->>'notes', '') AS notes,
      coalesce((item->>'review_required')::boolean, false) AS review_required,
      coalesce(item->>'review_reason', '') AS review_reason
    FROM jsonb_array_elements(p_rows) AS item
  ),
  upserted AS (
    INSERT INTO public.abnet_customer_registry (
      company_id, abnet_customer_number, customer_name, document_number,
      document_type, document_review, email, phone, address, city, province,
      commercial_status, person_type, tax_condition, abnet_client_id,
      source_balance, notes, review_required, review_reason, source_name,
      import_batch_id, created_at, updated_at
    )
    SELECT
      p_company_id, abnet_customer_number, customer_name, document_number,
      document_type, document_review, email, phone, address, city, province,
      commercial_status, person_type, tax_condition, abnet_client_id,
      source_balance, notes, review_required, review_reason, p_source_name,
      v_batch, v_now, v_now
    FROM incoming
    ON CONFLICT (company_id, abnet_customer_number) DO UPDATE SET
      customer_name = CASE WHEN btrim(EXCLUDED.customer_name) = '' THEN abnet_customer_registry.customer_name ELSE EXCLUDED.customer_name END,
      document_number = CASE WHEN btrim(EXCLUDED.document_number) = '' THEN abnet_customer_registry.document_number ELSE EXCLUDED.document_number END,
      document_type = CASE WHEN btrim(EXCLUDED.document_type) = '' THEN abnet_customer_registry.document_type ELSE EXCLUDED.document_type END,
      document_review = EXCLUDED.document_review,
      email = CASE WHEN btrim(EXCLUDED.email) = '' THEN abnet_customer_registry.email ELSE EXCLUDED.email END,
      phone = CASE WHEN btrim(EXCLUDED.phone) = '' THEN abnet_customer_registry.phone ELSE EXCLUDED.phone END,
      address = CASE WHEN btrim(EXCLUDED.address) = '' THEN abnet_customer_registry.address ELSE EXCLUDED.address END,
      city = CASE WHEN btrim(EXCLUDED.city) = '' THEN abnet_customer_registry.city ELSE EXCLUDED.city END,
      province = CASE WHEN btrim(EXCLUDED.province) = '' THEN abnet_customer_registry.province ELSE EXCLUDED.province END,
      commercial_status = CASE WHEN btrim(EXCLUDED.commercial_status) = '' THEN abnet_customer_registry.commercial_status ELSE EXCLUDED.commercial_status END,
      person_type = CASE WHEN btrim(EXCLUDED.person_type) = '' THEN abnet_customer_registry.person_type ELSE EXCLUDED.person_type END,
      tax_condition = CASE WHEN btrim(EXCLUDED.tax_condition) = '' THEN abnet_customer_registry.tax_condition ELSE EXCLUDED.tax_condition END,
      abnet_client_id = CASE WHEN btrim(EXCLUDED.abnet_client_id) = '' THEN abnet_customer_registry.abnet_client_id ELSE EXCLUDED.abnet_client_id END,
      source_balance = CASE WHEN btrim(EXCLUDED.source_balance) = '' THEN abnet_customer_registry.source_balance ELSE EXCLUDED.source_balance END,
      notes = CASE WHEN btrim(EXCLUDED.notes) = '' THEN abnet_customer_registry.notes ELSE EXCLUDED.notes END,
      review_required = EXCLUDED.review_required,
      review_reason = EXCLUDED.review_reason,
      source_name = EXCLUDED.source_name,
      import_batch_id = EXCLUDED.import_batch_id,
      updated_at = EXCLUDED.updated_at
    RETURNING (created_at = v_now) AS inserted
  )
  SELECT
    count(*) FILTER (WHERE inserted),
    count(*) FILTER (WHERE NOT inserted)
  INTO v_created, v_updated
  FROM upserted;

  RETURN jsonb_build_object(
    'batch_id', v_batch,
    'created', v_created,
    'updated', v_updated,
    'kept_outside_file', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_abnet_customer_registry(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_abnet_customer_registry(uuid, text, jsonb)
  TO service_role;
