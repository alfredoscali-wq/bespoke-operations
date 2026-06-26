-- =============================================================================
-- Bespoke Operations — Purga manual de OT de prueba (sin TRUNCATE)
-- =============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres / service)
--
-- NO elimina: clientes, empleados, obras, cuadrillas ni OT reales.
-- Elimina: OT de prueba + evidencias, fotos, storage, auditoría e historial
--          vinculados a esas OT.
--
-- FLUJO:
--   1) Revisar CONFIG abajo y ajustar criterios.
--   2) Ejecutar solo hasta "FIN PREVIEW" → validar SELECTs.
--   3) Ejecutar el bloque DELETE (descomentado) en la misma sesión o
--      volver a correr el script completo tras validar.
-- =============================================================================

-- =============================================================================
-- CONFIG — Editar aquí antes de ejecutar
-- =============================================================================
-- v_explicit_test_codes: códigos TSK-OT-xxx creados manualmente en pruebas UI
-- v_use_date_filter:     false por defecto (riesgo de borrar OT reales)
-- =============================================================================

DROP TABLE IF EXISTS _purge_test_ot_ids;

CREATE TEMP TABLE _purge_test_ot_ids AS
WITH config AS (
  SELECT
    ARRAY[]::text[] AS explicit_test_codes,
    -- Ejemplo: ARRAY['TSK-OT-003', 'TSK-OT-005']::text[] AS explicit_test_codes,
    false AS use_date_filter,
    timestamptz '2026-06-01 00:00:00+00' AS created_at_from,
    timestamptz '2026-06-26 23:59:59+00' AS created_at_to
)
SELECT
  t.id,
  t.code,
  t.title,
  t.project_code,
  t.project_name,
  t.customer_name,
  t.customer_id,
  t.service_type,
  t.status,
  t.created_at,
  t.deleted_at
FROM public.tasks t
CROSS JOIN config cfg
WHERE
  (t.service_type IS NOT NULL OR t.project_code = 'OT')
  AND (
    t.code ~ '^(E2E-|TK-|TSK-AUDIT-)'
    OR t.code = ANY (cfg.explicit_test_codes)
    OR lower(coalesce(t.customer_name, t.project_name, '')) ~ '(test|prueba|demo|xxx|cliente prueba)'
    OR EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = t.customer_id
        AND lower(coalesce(c.name, '')) ~ '(test|prueba|demo|xxx|cliente prueba)'
    )
    OR lower(coalesce(t.title, '')) ~ '(audit temp|seed|validaci.n crud|tarea seed|prueba funcional)'
    OR lower(coalesce(t.description, '')) ~ '(audit temp|seed|validaci.n crud|tarea seed|prueba funcional|temporary row)'
    OR lower(coalesce(t.observations_for_crew, '')) ~ '(audit temp|seed|prueba funcional)'
    OR (
      cfg.use_date_filter
      AND t.created_at BETWEEN cfg.created_at_from AND cfg.created_at_to
    )
  );

CREATE INDEX ON _purge_test_ot_ids (id);
CREATE INDEX ON _purge_test_ot_ids (code);

-- =============================================================================
-- PREVIEW — Qué se eliminará (revisar antes de borrar)
-- =============================================================================

-- Resumen OT de prueba identificadas
SELECT
  'PREVIEW' AS phase,
  'tasks (OT de prueba)' AS entity,
  COUNT(*) AS row_count
FROM _purge_test_ot_ids;

SELECT
  id,
  code,
  title,
  project_name AS cliente_snapshot,
  customer_id,
  service_type,
  status,
  created_at,
  deleted_at
FROM _purge_test_ot_ids
ORDER BY code, created_at;

-- task_photos (incluye soft-deleted)
SELECT
  'PREVIEW' AS phase,
  'task_photos' AS entity,
  COUNT(*) AS row_count
FROM public.task_photos tp
WHERE tp.task_id IN (SELECT id FROM _purge_test_ot_ids);

SELECT tp.id, tp.task_id, p.code AS task_code, tp.storage_bucket, tp.storage_path, tp.file_name
FROM public.task_photos tp
JOIN _purge_test_ot_ids p ON p.id = tp.task_id
ORDER BY p.code, tp.uploaded_at;

-- evidences (por task_id o task_code huérfano)
SELECT
  'PREVIEW' AS phase,
  'evidences' AS entity,
  COUNT(*) AS row_count
FROM public.evidences e
WHERE e.task_id IN (SELECT id FROM _purge_test_ot_ids)
   OR e.task_code IN (SELECT code FROM _purge_test_ot_ids);

SELECT e.id, e.task_id, e.task_code, e.task_title, e.storage_bucket, e.storage_path, e.deleted_at
FROM public.evidences e
WHERE e.task_id IN (SELECT id FROM _purge_test_ot_ids)
   OR e.task_code IN (SELECT code FROM _purge_test_ot_ids)
ORDER BY e.task_code, e.uploaded_at;

-- system_audit_log — eventos de la OT
SELECT
  'PREVIEW' AS phase,
  'system_audit_log (entity task)' AS entity,
  COUNT(*) AS row_count
FROM public.system_audit_log sal
WHERE sal.entity_type = 'task'
  AND sal.entity_id IN (SELECT id FROM _purge_test_ot_ids);

SELECT sal.id, sal.module, sal.action, sal.entity_type, sal.entity_id, sal.entity_label, sal.created_at
FROM public.system_audit_log sal
WHERE sal.entity_type = 'task'
  AND sal.entity_id IN (SELECT id FROM _purge_test_ot_ids)
ORDER BY sal.created_at;

-- system_audit_log — sync cliente←OT (metadata.taskId / taskCode)
SELECT
  'PREVIEW' AS phase,
  'system_audit_log (metadata taskId)' AS entity,
  COUNT(*) AS row_count
FROM public.system_audit_log sal
WHERE sal.metadata->>'taskId' IN (SELECT id::text FROM _purge_test_ot_ids)
   OR sal.metadata->>'taskCode' IN (SELECT code FROM _purge_test_ot_ids);

SELECT sal.id, sal.module, sal.action, sal.entity_type, sal.entity_id, sal.metadata->>'taskCode' AS task_code, sal.created_at
FROM public.system_audit_log sal
WHERE sal.metadata->>'taskId' IN (SELECT id::text FROM _purge_test_ot_ids)
   OR sal.metadata->>'taskCode' IN (SELECT code FROM _purge_test_ot_ids)
ORDER BY sal.created_at;

-- storage.objects — fotos de OT
SELECT
  'PREVIEW' AS phase,
  'storage.objects (task-photos)' AS entity,
  COUNT(*) AS row_count
FROM storage.objects so
WHERE so.bucket_id = 'task-photos'
  AND so.name IN (
    SELECT tp.storage_path
    FROM public.task_photos tp
    WHERE tp.task_id IN (SELECT id FROM _purge_test_ot_ids)
  );

SELECT so.bucket_id, so.name, so.created_at
FROM storage.objects so
WHERE so.bucket_id = 'task-photos'
  AND so.name IN (
    SELECT tp.storage_path
    FROM public.task_photos tp
    WHERE tp.task_id IN (SELECT id FROM _purge_test_ot_ids)
  )
ORDER BY so.name;

-- storage.objects — evidencias de OT
SELECT
  'PREVIEW' AS phase,
  'storage.objects (evidences)' AS entity,
  COUNT(*) AS row_count
FROM storage.objects so
WHERE so.bucket_id = 'evidences'
  AND so.name IN (
    SELECT e.storage_path
    FROM public.evidences e
    WHERE (e.task_id IN (SELECT id FROM _purge_test_ot_ids)
           OR e.task_code IN (SELECT code FROM _purge_test_ot_ids))
      AND e.storage_path IS NOT NULL
  );

SELECT so.bucket_id, so.name, so.created_at
FROM storage.objects so
WHERE so.bucket_id = 'evidences'
  AND so.name IN (
    SELECT e.storage_path
    FROM public.evidences e
    WHERE (e.task_id IN (SELECT id FROM _purge_test_ot_ids)
           OR e.task_code IN (SELECT code FROM _purge_test_ot_ids))
      AND e.storage_path IS NOT NULL
  )
ORDER BY so.name;

-- Datos embebidos en tasks (checklist, operational_steps, task_metadata) — se eliminan con la OT
SELECT
  'PREVIEW' AS phase,
  'tasks.checklist / operational_steps / task_metadata (embebidos)' AS entity,
  COUNT(*) AS row_count
FROM _purge_test_ot_ids;

-- =============================================================================
-- FIN PREVIEW — Validar resultados arriba antes de continuar
-- =============================================================================
-- Si el conjunto es correcto, ejecutar el bloque DELETE siguiente.
-- Si falta alguna OT (ej. TSK-OT-005 con cliente real), agregar su código en
-- ARRAY['TSK-OT-005']::text[] en CREATE TEMP TABLE ... AND ( ... OR t.code = ANY ...)
-- y volver a ejecutar desde el CREATE TEMP TABLE.
-- =============================================================================


-- =============================================================================
-- DELETE — Descomentar y ejecutar solo tras validar PREVIEW
-- =============================================================================

/*
BEGIN;

-- 1) Archivos en Storage (antes que las filas que referencian paths)
DELETE FROM storage.objects so
WHERE so.bucket_id = 'task-photos'
  AND so.name IN (
    SELECT tp.storage_path
    FROM public.task_photos tp
    WHERE tp.task_id IN (SELECT id FROM _purge_test_ot_ids)
  );

DELETE FROM storage.objects so
WHERE so.bucket_id = 'evidences'
  AND so.name IN (
    SELECT e.storage_path
    FROM public.evidences e
    WHERE (e.task_id IN (SELECT id FROM _purge_test_ot_ids)
           OR e.task_code IN (SELECT code FROM _purge_test_ot_ids))
      AND e.storage_path IS NOT NULL
  );

-- 2) Hijos directos con FK a tasks
DELETE FROM public.task_photos tp
WHERE tp.task_id IN (SELECT id FROM _purge_test_ot_ids);

DELETE FROM public.evidences e
WHERE e.task_id IN (SELECT id FROM _purge_test_ot_ids)
   OR e.task_code IN (SELECT code FROM _purge_test_ot_ids);

-- 3) Auditoría e historial del sistema vinculado a esas OT
DELETE FROM public.system_audit_log sal
WHERE (sal.entity_type = 'task' AND sal.entity_id IN (SELECT id FROM _purge_test_ot_ids))
   OR sal.metadata->>'taskId' IN (SELECT id::text FROM _purge_test_ot_ids)
   OR sal.metadata->>'taskCode' IN (SELECT code FROM _purge_test_ot_ids);

-- 4) OT de prueba (incluye soft-deleted; checklist/steps/metadata van en la fila)
DELETE FROM public.tasks t
WHERE t.id IN (SELECT id FROM _purge_test_ot_ids);

COMMIT;
*/


-- =============================================================================
-- VERIFICACIÓN — Ejecutar tras DELETE; debe devolver 0 en todas las filas
-- =============================================================================

/*
SELECT 'VERIFY' AS phase, 'orphan task_photos' AS check_name, COUNT(*) AS remaining
FROM public.task_photos tp
WHERE tp.task_id IN (SELECT id FROM _purge_test_ot_ids)
UNION ALL
SELECT 'VERIFY', 'orphan evidences (task_id)', COUNT(*)
FROM public.evidences e
WHERE e.task_id IN (SELECT id FROM _purge_test_ot_ids)
UNION ALL
SELECT 'VERIFY', 'orphan evidences (task_code)', COUNT(*)
FROM public.evidences e
WHERE e.task_code IN (SELECT code FROM _purge_test_ot_ids)
UNION ALL
SELECT 'VERIFY', 'orphan system_audit_log (entity)', COUNT(*)
FROM public.system_audit_log sal
WHERE sal.entity_type = 'task'
  AND sal.entity_id IN (SELECT id FROM _purge_test_ot_ids)
UNION ALL
SELECT 'VERIFY', 'orphan system_audit_log (metadata)', COUNT(*)
FROM public.system_audit_log sal
WHERE sal.metadata->>'taskId' IN (SELECT id::text FROM _purge_test_ot_ids)
   OR sal.metadata->>'taskCode' IN (SELECT code FROM _purge_test_ot_ids)
UNION ALL
SELECT 'VERIFY', 'remaining test OT rows', COUNT(*)
FROM public.tasks t
WHERE t.id IN (SELECT id FROM _purge_test_ot_ids)
UNION ALL
SELECT 'VERIFY', 'storage task-photos orphans', COUNT(*)
FROM storage.objects so
WHERE so.bucket_id = 'task-photos'
  AND so.name IN (
    SELECT tp.storage_path FROM public.task_photos tp
    WHERE tp.task_id IN (SELECT id FROM _purge_test_ot_ids)
  )
UNION ALL
SELECT 'VERIFY', 'storage evidences orphans', COUNT(*)
FROM storage.objects so
WHERE so.bucket_id = 'evidences'
  AND so.name IN (
    SELECT e.storage_path FROM public.evidences e
    WHERE e.task_id IN (SELECT id FROM _purge_test_ot_ids)
       OR e.task_code IN (SELECT code FROM _purge_test_ot_ids)
  );

-- FK hacia tasks desde otras tablas públicas (debe quedar vacío)
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_schema = 'public'
  AND ccu.table_name = 'tasks'
ORDER BY tc.table_name, kcu.column_name;
*/
