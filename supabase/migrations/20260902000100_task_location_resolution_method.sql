-- GPS 2.0: persist how shared locations were resolved (inline vs redirect).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS location_resolution_method text;

COMMENT ON COLUMN public.tasks.location_resolution_method IS
  'How shared_location was resolved: inline (parsed locally) or redirect (followed Google short URL).';
