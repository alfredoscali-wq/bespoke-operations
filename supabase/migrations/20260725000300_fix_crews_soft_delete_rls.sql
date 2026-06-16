-- Bespoke Operations — Fix crews / crew_members RLS to allow soft delete via deleted_at UPDATE
-- The previous WITH CHECK (deleted_at IS NULL) blocked setting deleted_at on soft delete.

DROP POLICY IF EXISTS crews_update_policy ON public.crews;

CREATE POLICY crews_update_policy
  ON public.crews
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (true);

DROP POLICY IF EXISTS crew_members_update_policy ON public.crew_members;

CREATE POLICY crew_members_update_policy
  ON public.crew_members
  FOR UPDATE
  USING (deleted_at IS NULL)
  WITH CHECK (true);
