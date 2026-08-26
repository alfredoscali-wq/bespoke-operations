-- ISP 1.7 — Presentation template for billing documents.
-- Additive only. Does not emit documents, call ARCA/SIRO, alter snapshots,
-- numbering, taxes, customers, services, or the monthly billing engine.

ALTER TABLE public.isp_billing_company_settings
  ADD COLUMN IF NOT EXISTS template_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'show_logo', true,
    'logo_position', 'left',
    'show_phone', true,
    'show_email', true,
    'show_address', true,
    'show_observations', true,
    'footer_legend', ''
  );

ALTER TABLE public.isp_billing_company_settings
  DROP CONSTRAINT IF EXISTS isp_billing_company_settings_template_settings_object;

ALTER TABLE public.isp_billing_company_settings
  ADD CONSTRAINT isp_billing_company_settings_template_settings_object
  CHECK (jsonb_typeof(template_settings) = 'object');

COMMENT ON COLUMN public.isp_billing_company_settings.template_settings IS
  'Presentation-only comprobante template flags. Never stores HTML/CSS, binaries, or fiscal snapshots.';
