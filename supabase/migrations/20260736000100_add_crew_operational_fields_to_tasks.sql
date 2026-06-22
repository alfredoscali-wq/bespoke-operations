-- SPRINT TAREAS 2.1 — crew-facing operational fields on tasks

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS shared_location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS observations_for_crew text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.tasks.shared_location IS
  'Free-text shared location for the crew (maps URL, coordinates, etc.).';

COMMENT ON COLUMN public.tasks.observations_for_crew IS
  'Operational notes for the assigned crew, separate from administrative description.';
