-- Bespoke Operations — Fix tasks RLS to allow soft delete via deleted_at UPDATE
-- The previous WITH CHECK (deleted_at IS NULL) blocked setting deleted_at on soft delete.

DROP POLICY IF EXISTS tasks_update_policy ON public.tasks;

CREATE POLICY tasks_update_policy
  ON public.tasks
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (true);

COMMENT ON POLICY tasks_update_policy ON public.tasks IS
  'Allows updates on active rows, including soft delete (deleted_at).';
