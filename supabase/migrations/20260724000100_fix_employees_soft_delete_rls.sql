-- Bespoke Operations — Fix employees RLS to allow soft delete via deleted_at UPDATE
-- The previous WITH CHECK (deleted_at IS NULL) blocked setting deleted_at on soft delete.

DROP POLICY IF EXISTS employees_update_policy ON public.employees;

CREATE POLICY employees_update_policy
  ON public.employees
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (true);
