-- Comercial 1.6 — Inicio Comercial (escritorio del vendedor).
-- Fuente Atención al Cliente, apertura por vendedor, actividad de derivación.

INSERT INTO public.commercial_sources (code, label, sort_order) VALUES
  ('atencion_cliente', 'Atención al Cliente', 75)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.commercial_activity_types (code, label, sort_order) VALUES
  ('derivacion', 'Derivación desde Atención al Cliente', 95)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.commercial_opportunities
  ADD COLUMN IF NOT EXISTS seller_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_atencion_id uuid
    REFERENCES public.customer_atenciones (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_customer_id uuid
    REFERENCES public.customers (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_opportunities_source_atencion_uidx
  ON public.commercial_opportunities (company_id, source_atencion_id)
  WHERE source_atencion_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_opportunities_seller_opened_at_idx
  ON public.commercial_opportunities (company_id, seller_opened_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_opportunities_source_customer_id_idx
  ON public.commercial_opportunities (source_customer_id)
  WHERE source_customer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS commercial_commitments_company_due_status_idx
  ON public.commercial_commitments (company_id, due_at, status)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.commercial_opportunities.seller_opened_at IS
  'Primera apertura del expediente por un vendedor. NULL = figura como nueva derivación.';

COMMENT ON COLUMN public.commercial_opportunities.source_atencion_id IS
  'Consulta de Atención al Cliente que originó o actualizó la oportunidad.';
