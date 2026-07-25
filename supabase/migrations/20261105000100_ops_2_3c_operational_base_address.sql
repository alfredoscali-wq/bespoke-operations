-- OPS 2.3C — operational base address for crew depot configuration.

ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS operational_base_address text;

COMMENT ON COLUMN public.crews.operational_base_address IS
  'OPS 2.3C — street/display address of the crew operational base (GPS remains authoritative).';
