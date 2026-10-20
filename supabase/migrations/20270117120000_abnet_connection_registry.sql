-- Reference registry for ABNet connections.
-- One row per ABNet connection Id. It does not create isp_services,
-- isp_connections, PPPoE credentials, provisions, suspensions or invoices.
-- Rows missing from a later import are kept.

CREATE TABLE IF NOT EXISTS public.abnet_connection_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  abnet_connection_id text NOT NULL,
  abnet_customer_number text NOT NULL,
  abnet_client_id text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT '',
  node_name text NOT NULL DEFAULT '',
  plan_name text NOT NULL DEFAULT '',
  connection_status text NOT NULL
    CHECK (connection_status IN (
      'activa', 'morosa', 'pendiente', 'inactiva',
      'suspendida', 'bloqueada', 'desconocida'
    )),
  raw_status text NOT NULL DEFAULT '',
  gratis text NOT NULL DEFAULT 'desconocido'
    CHECK (gratis IN ('si', 'no', 'desconocido')),
  incobrable text NOT NULL DEFAULT 'desconocido'
    CHECK (incobrable IN ('si', 'no', 'desconocido')),
  company_label text NOT NULL DEFAULT '',
  alta_at timestamptz,
  baja_registered_at timestamptz,
  baja_effective_at timestamptz,
  baja_reason text NOT NULL DEFAULT '',
  suspension_from timestamptz,
  suspension_until timestamptz,
  suspension_reason text NOT NULL DEFAULT '',
  replaced_connection_id text NOT NULL DEFAULT '',
  source_name text NOT NULL,
  import_batch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT abnet_connection_registry_company_connection_uidx
    UNIQUE (company_id, abnet_connection_id)
);

COMMENT ON TABLE public.abnet_connection_registry IS
  'Imported ABNet connection reference. Not a technical Bespoke connection and not a customer.';

CREATE INDEX IF NOT EXISTS abnet_connection_registry_company_number_idx
  ON public.abnet_connection_registry (company_id, abnet_customer_number);

ALTER TABLE public.abnet_connection_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'abnet_connection_registry'
      AND policyname = 'abnet_connection_registry_select_policy'
  ) THEN
    CREATE POLICY abnet_connection_registry_select_policy
      ON public.abnet_connection_registry
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

GRANT SELECT ON public.abnet_connection_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abnet_connection_registry TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_abnet_connection_registry(
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
    RAISE EXCEPTION 'cantidad de conexiones invalida';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS item
    WHERE btrim(coalesce(item->>'abnet_connection_id', '')) = ''
      OR btrim(coalesce(item->>'abnet_customer_number', '')) = ''
      OR coalesce(item->>'connection_status', '') NOT IN (
        'activa', 'morosa', 'pendiente', 'inactiva',
        'suspendida', 'bloqueada', 'desconocida'
      )
      OR coalesce(item->>'gratis', '') NOT IN ('si', 'no', 'desconocido')
      OR coalesce(item->>'incobrable', '') NOT IN ('si', 'no', 'desconocido')
  ) THEN
    RAISE EXCEPTION 'fila invalida';
  END IF;
  IF EXISTS (
    SELECT item->>'abnet_connection_id'
    FROM jsonb_array_elements(p_rows) AS item
    GROUP BY item->>'abnet_connection_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'id repetido';
  END IF;

  WITH incoming AS (
    SELECT
      btrim(item->>'abnet_connection_id') AS abnet_connection_id,
      btrim(item->>'abnet_customer_number') AS abnet_customer_number,
      coalesce(item->>'abnet_client_id', '') AS abnet_client_id,
      coalesce(item->>'customer_name', '') AS customer_name,
      coalesce(item->>'service_type', '') AS service_type,
      coalesce(item->>'node_name', '') AS node_name,
      coalesce(item->>'plan_name', '') AS plan_name,
      item->>'connection_status' AS connection_status,
      coalesce(item->>'raw_status', '') AS raw_status,
      item->>'gratis' AS gratis,
      item->>'incobrable' AS incobrable,
      coalesce(item->>'company_label', '') AS company_label,
      nullif(item->>'alta_at', '')::timestamptz AS alta_at,
      nullif(item->>'baja_registered_at', '')::timestamptz AS baja_registered_at,
      nullif(item->>'baja_effective_at', '')::timestamptz AS baja_effective_at,
      coalesce(item->>'baja_reason', '') AS baja_reason,
      nullif(item->>'suspension_from', '')::timestamptz AS suspension_from,
      nullif(item->>'suspension_until', '')::timestamptz AS suspension_until,
      coalesce(item->>'suspension_reason', '') AS suspension_reason,
      coalesce(item->>'replaced_connection_id', '') AS replaced_connection_id
    FROM jsonb_array_elements(p_rows) AS item
  ),
  upserted AS (
    INSERT INTO public.abnet_connection_registry (
      company_id, abnet_connection_id, abnet_customer_number, abnet_client_id,
      customer_name, service_type, node_name, plan_name, connection_status,
      raw_status, gratis, incobrable, company_label, alta_at, baja_registered_at,
      baja_effective_at, baja_reason, suspension_from, suspension_until,
      suspension_reason, replaced_connection_id, source_name, import_batch_id,
      created_at, updated_at
    )
    SELECT
      p_company_id, abnet_connection_id, abnet_customer_number, abnet_client_id,
      customer_name, service_type, node_name, plan_name, connection_status,
      raw_status, gratis, incobrable, company_label, alta_at, baja_registered_at,
      baja_effective_at, baja_reason, suspension_from, suspension_until,
      suspension_reason, replaced_connection_id, p_source_name, v_batch,
      v_now, v_now
    FROM incoming
    ON CONFLICT (company_id, abnet_connection_id) DO UPDATE SET
      abnet_customer_number = EXCLUDED.abnet_customer_number,
      abnet_client_id = EXCLUDED.abnet_client_id,
      customer_name = EXCLUDED.customer_name,
      service_type = EXCLUDED.service_type,
      node_name = EXCLUDED.node_name,
      plan_name = EXCLUDED.plan_name,
      connection_status = EXCLUDED.connection_status,
      raw_status = EXCLUDED.raw_status,
      gratis = EXCLUDED.gratis,
      incobrable = EXCLUDED.incobrable,
      company_label = EXCLUDED.company_label,
      alta_at = EXCLUDED.alta_at,
      baja_registered_at = EXCLUDED.baja_registered_at,
      baja_effective_at = EXCLUDED.baja_effective_at,
      baja_reason = EXCLUDED.baja_reason,
      suspension_from = EXCLUDED.suspension_from,
      suspension_until = EXCLUDED.suspension_until,
      suspension_reason = EXCLUDED.suspension_reason,
      replaced_connection_id = EXCLUDED.replaced_connection_id,
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

REVOKE ALL ON FUNCTION public.upsert_abnet_connection_registry(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_abnet_connection_registry(uuid, text, jsonb)
  TO service_role;
