-- Bespoke Mobile — tenant-visible company name.
-- Keeps the internal company name/slug/mobile code unchanged.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.companies.display_name IS
  'Optional tenant-visible commercial name for Bespoke Mobile and personalized interfaces. Blank values fall back to companies.name.';

UPDATE public.companies
SET display_name = 'ABNet'
WHERE id = '00000000-0000-4000-8000-000000000002'::uuid;
