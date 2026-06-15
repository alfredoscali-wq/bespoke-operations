-- =============================================================================
-- Bespoke Operations — Reset operational test data
-- =============================================================================
-- Run in: Supabase Dashboard → SQL Editor
--
-- Deletes ALL rows from operational tables (including soft-deleted rows).
-- Preserves: tables, indexes, enums, constraints, RLS policies, migrations,
--            companies (Bespoke Demo), and the evidences storage bucket config.
--
-- FK-safe order:
--   evidences → tasks → crew_members → crews → projects
--
-- Optional (see bottom): storage.objects in bucket "evidences" — files remain
-- after row cleanup unless you run the optional block.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Counts BEFORE cleanup
-- -----------------------------------------------------------------------------
SELECT
  'BEFORE' AS phase,
  table_name,
  total_rows,
  active_rows,
  soft_deleted_rows
FROM (
  SELECT
    'evidences'::text AS table_name,
    COUNT(*)::bigint AS total_rows,
    COUNT(*) FILTER (WHERE deleted_at IS NULL)::bigint AS active_rows,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::bigint AS soft_deleted_rows
  FROM public.evidences

  UNION ALL

  SELECT
    'tasks',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
  FROM public.tasks

  UNION ALL

  SELECT
    'crew_members',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
  FROM public.crew_members

  UNION ALL

  SELECT
    'crews',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
  FROM public.crews

  UNION ALL

  SELECT
    'projects',
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
  FROM public.projects
) counts
ORDER BY
  CASE table_name
    WHEN 'evidences' THEN 1
    WHEN 'tasks' THEN 2
    WHEN 'crew_members' THEN 3
    WHEN 'crews' THEN 4
    WHEN 'projects' THEN 5
  END;

-- Reference: tenant demo company (must remain)
SELECT
  'BEFORE' AS phase,
  'companies (preserved)' AS table_name,
  COUNT(*)::bigint AS total_rows
FROM public.companies;

-- -----------------------------------------------------------------------------
-- 2) Cleanup (operational data only)
-- -----------------------------------------------------------------------------

DELETE FROM public.evidences;
DELETE FROM public.tasks;
DELETE FROM public.crew_members;
DELETE FROM public.crews;
DELETE FROM public.projects;

-- -----------------------------------------------------------------------------
-- 3) Counts AFTER cleanup (expected: all zeros)
-- -----------------------------------------------------------------------------
SELECT
  'AFTER' AS phase,
  table_name,
  total_rows
FROM (
  SELECT 'projects'::text AS table_name, COUNT(*)::bigint AS total_rows
  FROM public.projects

  UNION ALL

  SELECT 'tasks', COUNT(*) FROM public.tasks

  UNION ALL

  SELECT 'evidences', COUNT(*) FROM public.evidences

  UNION ALL

  SELECT 'crews', COUNT(*) FROM public.crews

  UNION ALL

  SELECT 'crew_members', COUNT(*) FROM public.crew_members
) counts
ORDER BY
  CASE table_name
    WHEN 'projects' THEN 1
    WHEN 'tasks' THEN 2
    WHEN 'evidences' THEN 3
    WHEN 'crews' THEN 4
    WHEN 'crew_members' THEN 5
  END;

-- Verify demo company still exists
SELECT
  'AFTER' AS phase,
  id,
  name,
  slug
FROM public.companies
WHERE deleted_at IS NULL
ORDER BY name;

COMMIT;

-- =============================================================================
-- OPTIONAL — orphan files in Storage (bucket kept, objects removed)
-- =============================================================================
-- Evidences rows reference storage_path but files live in storage.objects.
-- Run separately if you also want an empty bucket (no orphaned uploads):
--
-- BEGIN;
--
-- SELECT
--   'BEFORE' AS phase,
--   'storage.objects (evidences bucket)' AS table_name,
--   COUNT(*)::bigint AS total_rows
-- FROM storage.objects
-- WHERE bucket_id = 'evidences';
--
-- DELETE FROM storage.objects
-- WHERE bucket_id = 'evidences';
--
-- SELECT
--   'AFTER' AS phase,
--   'storage.objects (evidences bucket)' AS table_name,
--   COUNT(*)::bigint AS total_rows
-- FROM storage.objects
-- WHERE bucket_id = 'evidences';
--
-- COMMIT;
