-- Informe de Obra — persist manual OT selection on a share.
-- Does not change token hashing, password hashing, RLS or the public URL.

ALTER TABLE public.project_report_shares
  DROP CONSTRAINT IF EXISTS project_report_shares_task_scope_check;

ALTER TABLE public.project_report_shares
  ADD CONSTRAINT project_report_shares_task_scope_check
  CHECK (task_scope IN ('all', 'completed', 'selected'));

ALTER TABLE public.project_report_shares
  ADD COLUMN IF NOT EXISTS selected_task_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.project_report_shares.selected_task_ids IS
  'When task_scope is selected, the OT ids included in the shared report. Empty for all/completed.';
