-- ISP 1.6B — Operational billing documents (comprobantes).
-- Additive only. Does not call ARCA/SIRO, generate monthly invoices, or prorate.

CREATE TABLE public.isp_billing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  billing_company_settings_id uuid NOT NULL
    REFERENCES public.isp_billing_company_settings (id),
  point_of_sale_id uuid NOT NULL
    REFERENCES public.isp_billing_point_of_sales (id),
  document_type text NOT NULL
    CHECK (document_type IN (
      'factura_a',
      'factura_b',
      'factura_c',
      'comprobante_x',
      'presupuesto',
      'nota_credito',
      'nota_debito'
    )),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'issued',
      'cancelled',
      'pending_authorization',
      'authorized',
      'rejected'
    )),
  authorization_status text NOT NULL DEFAULT 'not_required'
    CHECK (authorization_status IN (
      'not_required',
      'pending_integration',
      'pending',
      'authorized',
      'rejected'
    )),
  issue_date date NOT NULL DEFAULT (timezone('America/Argentina/Buenos_Aires', now()))::date,
  due_date date,
  number integer CHECK (number IS NULL OR number >= 1),
  formatted_number text,
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  subscriber_id uuid REFERENCES public.isp_subscribers (id),
  customer_name_snapshot text NOT NULL,
  customer_document_type_snapshot text NOT NULL DEFAULT 'dni',
  customer_document_number_snapshot text NOT NULL DEFAULT '',
  customer_tax_id_snapshot text NOT NULL DEFAULT '',
  customer_vat_condition_snapshot text NOT NULL DEFAULT '',
  customer_tax_address_snapshot text NOT NULL DEFAULT '',
  customer_city_snapshot text NOT NULL DEFAULT '',
  customer_province_snapshot text NOT NULL DEFAULT '',
  customer_postal_code_snapshot text NOT NULL DEFAULT '',
  customer_email_snapshot text NOT NULL DEFAULT '',
  issuer_legal_name_snapshot text NOT NULL,
  issuer_tax_id_snapshot text NOT NULL,
  issuer_vat_condition_snapshot text NOT NULL,
  issuer_tax_address_snapshot text NOT NULL DEFAULT '',
  issuer_city_snapshot text NOT NULL DEFAULT '',
  issuer_province_snapshot text NOT NULL DEFAULT '',
  issuer_postal_code_snapshot text NOT NULL DEFAULT '',
  issuer_phone_snapshot text NOT NULL DEFAULT '',
  issuer_email_snapshot text NOT NULL DEFAULT '',
  issuer_website_snapshot text NOT NULL DEFAULT '',
  issuer_logo_url_snapshot text,
  point_of_sale_number integer NOT NULL CHECK (point_of_sale_number >= 1),
  subtotal numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  observations text NOT NULL DEFAULT '',
  cae text,
  cae_expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_billing_documents_number_unique
    UNIQUE (company_id, point_of_sale_id, document_type, number),
  CONSTRAINT isp_billing_documents_issued_has_number
    CHECK (status <> 'issued' OR number IS NOT NULL),
  CONSTRAINT isp_billing_documents_customer_name_required
    CHECK (btrim(customer_name_snapshot) <> ''),
  CONSTRAINT isp_billing_documents_cae_not_required
    CHECK (cae IS NULL)
);

COMMENT ON TABLE public.isp_billing_documents IS
  'Operational billing documents. Fiscal authorization and CAE remain unset until ARCA integration.';
COMMENT ON COLUMN public.isp_billing_documents.number IS
  'Assigned transactionally on issue. Drafts keep NULL to avoid consuming sequence numbers.';
COMMENT ON COLUMN public.isp_billing_documents.cae IS
  'Reserved for ARCA. Must remain NULL in ISP 1.6B.';
COMMENT ON COLUMN public.isp_billing_documents.authorization_status IS
  'not_required for X/Presupuesto. pending_integration for fiscal documents until ARCA exists.';

CREATE INDEX isp_billing_documents_company_issue_idx
  ON public.isp_billing_documents (company_id, issue_date DESC, created_at DESC);
CREATE INDEX isp_billing_documents_company_status_idx
  ON public.isp_billing_documents (company_id, status);
CREATE INDEX isp_billing_documents_company_type_idx
  ON public.isp_billing_documents (company_id, document_type);
CREATE INDEX isp_billing_documents_company_customer_idx
  ON public.isp_billing_documents (company_id, customer_id);
CREATE INDEX isp_billing_documents_company_pos_idx
  ON public.isp_billing_documents (company_id, point_of_sale_id);

CREATE TABLE public.isp_billing_document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  document_id uuid NOT NULL
    REFERENCES public.isp_billing_documents (id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.isp_services (id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  taxable_base numeric(14, 2) NOT NULL DEFAULT 0 CHECK (taxable_base >= 0),
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  tax_type text NOT NULL DEFAULT '',
  tax_rate numeric(8, 4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  line_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_billing_document_items_description_required
    CHECK (btrim(description) <> '')
);

COMMENT ON TABLE public.isp_billing_document_items IS
  'Line items of a billing document. tax_* columns are prepared; ISP 1.6B does not invent tax amounts.';

CREATE INDEX isp_billing_document_items_document_idx
  ON public.isp_billing_document_items (document_id, sort_order);
CREATE INDEX isp_billing_document_items_company_idx
  ON public.isp_billing_document_items (company_id);

CREATE TABLE public.isp_billing_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  document_id uuid NOT NULL
    REFERENCES public.isp_billing_documents (id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('created', 'updated', 'issued', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.isp_billing_document_events IS
  'Immutable history of document lifecycle events. Documents are never physically deleted.';

CREATE INDEX isp_billing_document_events_document_idx
  ON public.isp_billing_document_events (document_id, created_at);

CREATE TRIGGER isp_billing_documents_set_updated_at
  BEFORE UPDATE ON public.isp_billing_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_billing_document_items_set_updated_at
  BEFORE UPDATE ON public.isp_billing_document_items
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_isp_billing_document_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings_company uuid;
  v_pos_company uuid;
  v_customer_company uuid;
  v_subscriber_company uuid;
BEGIN
  SELECT company_id INTO v_settings_company
  FROM public.isp_billing_company_settings
  WHERE id = NEW.billing_company_settings_id;

  SELECT company_id INTO v_pos_company
  FROM public.isp_billing_point_of_sales
  WHERE id = NEW.point_of_sale_id;

  SELECT company_id INTO v_customer_company
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_settings_company IS DISTINCT FROM NEW.company_id
     OR v_pos_company IS DISTINCT FROM NEW.company_id
     OR v_customer_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El comprobante no puede asociarse a datos de otra empresa.';
  END IF;

  IF NEW.subscriber_id IS NOT NULL THEN
    SELECT company_id INTO v_subscriber_company
    FROM public.isp_subscribers
    WHERE id = NEW.subscriber_id;

    IF v_subscriber_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El abonado del comprobante pertenece a otra empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_billing_documents_enforce_company
  BEFORE INSERT OR UPDATE ON public.isp_billing_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_billing_document_company_match();

CREATE OR REPLACE FUNCTION public.enforce_isp_billing_document_item_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_company uuid;
  v_service_company uuid;
BEGIN
  SELECT company_id INTO v_document_company
  FROM public.isp_billing_documents
  WHERE id = NEW.document_id;

  IF v_document_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'El concepto no puede asociarse a un comprobante de otra empresa.';
  END IF;

  IF NEW.service_id IS NOT NULL THEN
    SELECT company_id INTO v_service_company
    FROM public.isp_services
    WHERE id = NEW.service_id;

    IF v_service_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El servicio del concepto pertenece a otra empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_billing_document_items_enforce_company
  BEFORE INSERT OR UPDATE ON public.isp_billing_document_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_billing_document_item_match();

CREATE OR REPLACE FUNCTION public.format_isp_billing_document_number(
  p_point_of_sale integer,
  p_number integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lpad(p_point_of_sale::text, 4, '0') || '-' || lpad(p_number::text, 8, '0');
$$;

CREATE OR REPLACE FUNCTION public.issue_isp_billing_document(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_doc public.isp_billing_documents%ROWTYPE;
  v_settings public.isp_billing_company_settings%ROWTYPE;
  v_pos public.isp_billing_point_of_sales%ROWTYPE;
  v_sequence public.isp_billing_document_sequences%ROWTYPE;
  v_item_count integer;
  v_assigned integer;
  v_formatted text;
  v_auth_status text;
  v_is_fiscal boolean;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_user_has_allowed_module('facturacion') THEN
    RAISE EXCEPTION 'No tiene permiso para emitir comprobantes.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'El modo demostración no permite emitir comprobantes.';
  END IF;

  SELECT * INTO v_doc
  FROM public.isp_billing_documents
  WHERE id = p_document_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comprobante no encontrado.';
  END IF;

  IF v_doc.status <> 'draft' THEN
    RAISE EXCEPTION 'Solo se pueden emitir comprobantes en borrador.';
  END IF;

  SELECT count(*) INTO v_item_count
  FROM public.isp_billing_document_items
  WHERE document_id = v_doc.id;

  IF v_item_count < 1 THEN
    RAISE EXCEPTION 'El comprobante debe tener al menos un concepto.';
  END IF;

  SELECT * INTO v_settings
  FROM public.isp_billing_company_settings
  WHERE id = v_doc.billing_company_settings_id
    AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falta la empresa facturadora.';
  END IF;

  SELECT * INTO v_pos
  FROM public.isp_billing_point_of_sales
  WHERE id = v_doc.point_of_sale_id
    AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falta el punto de venta.';
  END IF;

  INSERT INTO public.isp_billing_document_sequences (
    company_id,
    point_of_sale_id,
    document_type,
    next_number,
    issued_count
  )
  VALUES (
    v_company_id,
    v_doc.point_of_sale_id,
    v_doc.document_type,
    1,
    0
  )
  ON CONFLICT (company_id, point_of_sale_id, document_type) DO NOTHING;

  SELECT * INTO v_sequence
  FROM public.isp_billing_document_sequences
  WHERE company_id = v_company_id
    AND point_of_sale_id = v_doc.point_of_sale_id
    AND document_type = v_doc.document_type
  FOR UPDATE;

  v_assigned := v_sequence.next_number;
  v_formatted := public.format_isp_billing_document_number(
    v_pos.number,
    v_assigned
  );
  v_is_fiscal := v_doc.document_type NOT IN ('comprobante_x', 'presupuesto');
  v_auth_status := CASE
    WHEN v_is_fiscal THEN 'pending_integration'
    ELSE 'not_required'
  END;

  UPDATE public.isp_billing_document_sequences
  SET
    next_number = v_assigned + 1,
    issued_count = issued_count + 1,
    updated_at = now()
  WHERE id = v_sequence.id;

  UPDATE public.isp_billing_documents
  SET
    status = 'issued',
    authorization_status = v_auth_status,
    number = v_assigned,
    formatted_number = v_formatted,
    point_of_sale_number = v_pos.number,
    issuer_legal_name_snapshot = v_settings.legal_name,
    issuer_tax_id_snapshot = v_settings.tax_id,
    issuer_vat_condition_snapshot = v_settings.vat_condition,
    issuer_tax_address_snapshot = v_settings.tax_address,
    issuer_city_snapshot = v_settings.city,
    issuer_province_snapshot = v_settings.province,
    issuer_postal_code_snapshot = v_settings.postal_code,
    issuer_phone_snapshot = v_settings.phone,
    issuer_email_snapshot = v_settings.email,
    issuer_website_snapshot = v_settings.website,
    issuer_logo_url_snapshot = v_settings.logo_url,
    cae = NULL,
    cae_expires_at = NULL,
    updated_at = now()
  WHERE id = v_doc.id
    AND company_id = v_company_id;

  INSERT INTO public.isp_billing_document_events (
    company_id,
    document_id,
    event_type,
    payload
  )
  VALUES (
    v_company_id,
    v_doc.id,
    'issued',
    jsonb_build_object(
      'number', v_assigned,
      'formattedNumber', v_formatted,
      'authorizationStatus', v_auth_status
    )
  );

  RETURN jsonb_build_object(
    'id', v_doc.id,
    'number', v_assigned,
    'formattedNumber', v_formatted,
    'status', 'issued',
    'authorizationStatus', v_auth_status
  );
END;
$$;

COMMENT ON FUNCTION public.issue_isp_billing_document(uuid) IS
  'Consumes the next document number inside a row lock. Never uses SELECT MAX(number)+1.';

CREATE OR REPLACE FUNCTION public.cancel_isp_billing_document(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_doc public.isp_billing_documents%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_user_has_allowed_module('facturacion') THEN
    RAISE EXCEPTION 'No tiene permiso para anular comprobantes.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'El modo demostración no permite anular comprobantes.';
  END IF;

  SELECT * INTO v_doc
  FROM public.isp_billing_documents
  WHERE id = p_document_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comprobante no encontrado.';
  END IF;

  IF v_doc.status = 'cancelled' THEN
    RAISE EXCEPTION 'El comprobante ya está anulado.';
  END IF;

  UPDATE public.isp_billing_documents
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = v_doc.id
    AND company_id = v_company_id;

  INSERT INTO public.isp_billing_document_events (
    company_id,
    document_id,
    event_type,
    payload
  )
  VALUES (
    v_company_id,
    v_doc.id,
    'cancelled',
    jsonb_build_object('previousStatus', v_doc.status)
  );

  RETURN jsonb_build_object(
    'id', v_doc.id,
    'status', 'cancelled'
  );
END;
$$;

ALTER TABLE public.isp_billing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_billing_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_billing_document_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_billing_documents_select_policy
  ON public.isp_billing_documents
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_documents_write_policy
  ON public.isp_billing_documents
  FOR ALL
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_billing_document_items_select_policy
  ON public.isp_billing_document_items
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_document_items_write_policy
  ON public.isp_billing_document_items
  FOR ALL
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_billing_document_events_select_policy
  ON public.isp_billing_document_events
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_document_events_insert_policy
  ON public.isp_billing_document_events
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY isp_services_select_billing_policy
  ON public.isp_services
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_subscribers_select_billing_policy
  ON public.isp_subscribers
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

GRANT SELECT, INSERT, UPDATE ON public.isp_billing_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.isp_billing_document_items TO authenticated;
GRANT SELECT, INSERT ON public.isp_billing_document_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_isp_billing_document_number(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_isp_billing_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_isp_billing_document(uuid) TO authenticated;
