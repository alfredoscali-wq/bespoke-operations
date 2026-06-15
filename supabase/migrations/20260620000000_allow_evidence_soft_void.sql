-- Bespoke Operations — Allow evidence soft void (anular) with audit trail
-- Enables setting deleted_at and reading voided records for management views.

DROP POLICY IF EXISTS evidences_select_policy ON public.evidences;

CREATE POLICY evidences_select_policy
  ON public.evidences
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS evidences_update_policy ON public.evidences;

CREATE POLICY evidences_update_policy
  ON public.evidences
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON COLUMN public.evidences.deleted_at IS 'Soft void timestamp — record kept for audit; excluded from operational KPIs.';
