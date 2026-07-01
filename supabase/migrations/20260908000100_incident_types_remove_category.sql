-- Sprint 1.0.0B — Remove incident type category (out of v1.0 scope)

ALTER TABLE public.incident_types
  DROP CONSTRAINT IF EXISTS incident_types_category_valid;

ALTER TABLE public.incident_types
  DROP COLUMN IF EXISTS category;
