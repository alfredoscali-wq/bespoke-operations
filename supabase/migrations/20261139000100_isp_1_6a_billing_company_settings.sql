-- ISP 1.6A — Fiscal configuration of the single billing company.
-- Additive only. Does not emit invoices, call ARCA/SIRO, or alter customers/subscribers.

CREATE OR REPLACE FUNCTION public.is_valid_ar_cuit(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text;
  i int;
  total int := 0;
  remainder int;
  check_digit int;
  multipliers int[] := ARRAY[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
BEGIN
  d := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  IF length(d) <> 11 THEN
    RETURN false;
  END IF;

  FOR i IN 1..10 LOOP
    total := total + substring(d FROM i FOR 1)::int * multipliers[i];
  END LOOP;

  remainder := total % 11;
  check_digit := 11 - remainder;
  IF check_digit = 11 THEN check_digit := 0; END IF;
  IF check_digit = 10 THEN check_digit := 9; END IF;

  RETURN check_digit = substring(d FROM 11 FOR 1)::int;
END;
$$;

CREATE TABLE public.isp_billing_company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  legal_name text NOT NULL,
  tax_id text NOT NULL,
  vat_condition text NOT NULL
    CHECK (vat_condition IN (
      'responsable_inscripto',
      'monotributo',
      'exento',
      'consumidor_final'
    )),
  tax_address text NOT NULL,
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_billing_company_settings_company_unique UNIQUE (company_id),
  CONSTRAINT isp_billing_company_settings_tax_id_valid
    CHECK (public.is_valid_ar_cuit(tax_id)),
  CONSTRAINT isp_billing_company_settings_legal_name_required
    CHECK (btrim(legal_name) <> ''),
  CONSTRAINT isp_billing_company_settings_address_required
    CHECK (btrim(tax_address) <> '')
);

COMMENT ON TABLE public.isp_billing_company_settings IS
  'Single billing company per Bespoke installation. Not a multi-company catalog.';
COMMENT ON COLUMN public.isp_billing_company_settings.tax_id IS
  'CUIT of the issuer. Validated with the AFIP checksum.';
COMMENT ON COLUMN public.isp_billing_company_settings.logo_url IS
  'Public or storage URL of the optional billing logo. Never a secret.';

CREATE TABLE public.isp_billing_point_of_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  number integer NOT NULL CHECK (number >= 1 AND number <= 99999),
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_billing_point_of_sales_company_number_unique
    UNIQUE (company_id, number)
);

CREATE UNIQUE INDEX isp_billing_point_of_sales_one_active_idx
  ON public.isp_billing_point_of_sales (company_id)
  WHERE active = true;

COMMENT ON TABLE public.isp_billing_point_of_sales IS
  'Prepared for multiple points of sale. The first UI version keeps one active POS.';

CREATE TABLE public.isp_billing_document_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  point_of_sale_id uuid NOT NULL
    REFERENCES public.isp_billing_point_of_sales (id) ON DELETE CASCADE,
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
  next_number integer NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  issued_count integer NOT NULL DEFAULT 0 CHECK (issued_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_billing_document_sequences_unique
    UNIQUE (company_id, point_of_sale_id, document_type)
);

COMMENT ON TABLE public.isp_billing_document_sequences IS
  'Future document numbering. issued_count locks manual edits after real emission.';
COMMENT ON COLUMN public.isp_billing_document_sequences.issued_count IS
  'Incremented only when a document is actually issued. Remains 0 in ISP 1.6A.';

CREATE TABLE public.isp_billing_integrations (
  company_id uuid NOT NULL REFERENCES public.companies (id),
  provider text NOT NULL
    CHECK (provider IN ('arca', 'siro')),
  status text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured', 'pending', 'connected', 'error')),
  environment text
    CHECK (environment IS NULL OR environment IN ('testing', 'production')),
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, provider)
);

COMMENT ON TABLE public.isp_billing_integrations IS
  'Placeholder for future ARCA and SIRO connections. No secrets or credentials.';

CREATE OR REPLACE FUNCTION public.enforce_isp_billing_sequence_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.issued_count > 0 AND NEW.next_number IS DISTINCT FROM OLD.next_number THEN
    RAISE EXCEPTION 'La numeración no se puede modificar porque ya existen comprobantes emitidos.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER isp_billing_company_settings_set_updated_at
  BEFORE UPDATE ON public.isp_billing_company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_billing_point_of_sales_set_updated_at
  BEFORE UPDATE ON public.isp_billing_point_of_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_billing_document_sequences_set_updated_at
  BEFORE UPDATE ON public.isp_billing_document_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_billing_integrations_set_updated_at
  BEFORE UPDATE ON public.isp_billing_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_isp_updated_at();

CREATE TRIGGER isp_billing_document_sequences_lock
  BEFORE UPDATE ON public.isp_billing_document_sequences
  FOR EACH ROW EXECUTE FUNCTION public.enforce_isp_billing_sequence_lock();

ALTER TABLE public.isp_billing_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_billing_point_of_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_billing_document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isp_billing_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY isp_billing_company_settings_select_policy
  ON public.isp_billing_company_settings
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_company_settings_write_policy
  ON public.isp_billing_company_settings
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

CREATE POLICY isp_billing_point_of_sales_select_policy
  ON public.isp_billing_point_of_sales
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_point_of_sales_write_policy
  ON public.isp_billing_point_of_sales
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

CREATE POLICY isp_billing_document_sequences_select_policy
  ON public.isp_billing_document_sequences
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_document_sequences_write_policy
  ON public.isp_billing_document_sequences
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

CREATE POLICY isp_billing_integrations_select_policy
  ON public.isp_billing_integrations
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
  );

CREATE POLICY isp_billing_integrations_write_policy
  ON public.isp_billing_integrations
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

GRANT SELECT, INSERT, UPDATE ON public.isp_billing_company_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.isp_billing_point_of_sales TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.isp_billing_document_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.isp_billing_integrations TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'isp-billing-logos',
  'isp-billing-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY isp_billing_logos_select_policy
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'isp-billing-logos'
    AND (
      public.auth_user_has_allowed_module('facturacion')
      OR public.auth_user_company_id()::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY isp_billing_logos_write_policy
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'isp-billing-logos'
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'isp-billing-logos'
    AND public.auth_user_has_allowed_module('facturacion')
    AND NOT public.auth_is_demo_platform_read_only()
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  );

UPDATE public.company_roles
SET module_visibility = module_visibility || '{"facturacion": true}'::jsonb
WHERE code IN ('administrador', 'administracion');

UPDATE public.company_roles
SET module_visibility = coalesce(module_visibility, '{}'::jsonb) || '{"facturacion": false}'::jsonb
WHERE code NOT IN ('administrador', 'administracion');
