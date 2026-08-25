-- ISP 1.2.1 hotfix — example template rows are ignored and do not create
-- an empty pending_review migration.

ALTER TABLE public.isp_migration_runs
  DROP CONSTRAINT IF EXISTS isp_migration_runs_status_check;

ALTER TABLE public.isp_migration_runs
  ADD CONSTRAINT isp_migration_runs_status_check
  CHECK (status IN (
    'validating',
    'pending_review',
    'validated',
    'rejected',
    'no_real_data',
    'completed',
    'failed'
  ));

COMMENT ON CONSTRAINT isp_migration_runs_status_check ON public.isp_migration_runs IS
  'no_real_data: official template examples only. Never confirm an empty import.';
