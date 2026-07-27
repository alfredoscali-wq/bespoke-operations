-- Comercial 1.5 — Territorio comercial (coordenadas en oportunidades).

CREATE TYPE public.commercial_location_source AS ENUM (
  'manual',
  'gps',
  'customer_service',
  'import'
);

ALTER TABLE public.commercial_opportunities
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS location_source public.commercial_location_source;

COMMENT ON COLUMN public.commercial_opportunities.latitude IS
  'Latitud WGS84 de la oportunidad comercial.';
COMMENT ON COLUMN public.commercial_opportunities.longitude IS
  'Longitud WGS84 de la oportunidad comercial.';
COMMENT ON COLUMN public.commercial_opportunities.location_source IS
  'Origen de la ubicación (manual, gps, customer_service, import).';

ALTER TABLE public.commercial_opportunities
  DROP CONSTRAINT IF EXISTS commercial_opportunities_coordinates_pair_check;

ALTER TABLE public.commercial_opportunities
  ADD CONSTRAINT commercial_opportunities_coordinates_pair_check
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS commercial_opportunities_company_lat_lng_idx
  ON public.commercial_opportunities (company_id, latitude, longitude)
  WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
