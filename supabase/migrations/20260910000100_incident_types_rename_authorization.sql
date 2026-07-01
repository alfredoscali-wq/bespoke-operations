-- Product adjustment: replace "authorization" with "supervisor intervention" concept.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'incident_types'
      AND column_name = 'requires_authorization'
  ) THEN
    ALTER TABLE public.incident_types
      RENAME COLUMN requires_authorization TO requires_supervisor_intervention;
  END IF;
END $$;

COMMENT ON COLUMN public.incident_types.requires_supervisor_intervention IS
  'When true, reporting this incident type requires supervisor intervention. The OT stays paused until the supervisor resolves the incident (continue, reschedule, or cancel — future sprint).';
