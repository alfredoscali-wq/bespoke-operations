-- Bespoke Operations — Sprint 2: optional project dates for planned obras
-- Allows creating projects in "planned" status without start/end dates.
-- Existing rows keep their dates unchanged.

ALTER TABLE public.projects
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_dates_valid;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_dates_valid
  CHECK (
    start_date IS NULL
    OR end_date IS NULL
    OR end_date >= start_date
  );

COMMENT ON COLUMN public.projects.start_date IS 'Optional planned or actual start date (legacy column until estimated/actual split).';
COMMENT ON COLUMN public.projects.end_date IS 'Optional planned or target end date (legacy column until estimated/actual split).';
