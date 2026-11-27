-- Índices de retención y listados.
-- Ejecutar cada sentencia por separado, fuera de una transacción.
-- CREATE INDEX CONCURRENTLY no puede correr dentro de BEGIN/COMMIT.
-- Después de crear los índices se ejecuta ANALYZE. No se vacía la tabla por completo.

-- Lotes de retención, también filas con deleted_at.
-- Cubre WHERE job_type = ... AND status = ...
-- AND COALESCE(completed_at, created_at) < corte
-- ORDER BY COALESCE(completed_at, created_at), id
CREATE INDEX CONCURRENTLY network_agent_jobs_retention_idx
  ON public.network_agent_jobs (
    job_type,
    status,
    (COALESCE(completed_at, created_at)),
    id
  );

-- Listados de Jobs, Discovery, Topology y Destinos.
-- Esas consultas filtran deleted_at IS NULL y ordenan por created_at.
CREATE INDEX CONCURRENTLY network_agent_jobs_company_type_created_idx
  ON public.network_agent_jobs (company_id, job_type, created_at DESC)
  WHERE deleted_at IS NULL;

-- Poll del Agent: el pending más antiguo de un agent.
CREATE INDEX CONCURRENTLY network_agent_jobs_pending_claim_idx
  ON public.network_agent_jobs (agent_id, created_at)
  WHERE deleted_at IS NULL
    AND status = 'pending';

-- Borrado de eventos antes que el job. La clave foránea no tiene índice propio.
CREATE INDEX CONCURRENTLY network_device_status_events_job_idx
  ON public.network_device_status_events (job_id)
  WHERE job_id IS NOT NULL;

-- Verificación, después de crear los índices. No modifica datos.
-- indisvalid = false indica un CREATE INDEX CONCURRENTLY que quedó a medias.
SELECT
  clase.relname AS indice,
  indice.indisvalid,
  indice.indisready,
  indice.indislive
FROM pg_index AS indice
JOIN pg_class AS clase ON clase.oid = indice.indexrelid
JOIN pg_namespace AS esquema ON esquema.oid = clase.relnamespace
WHERE esquema.nspname = 'public'
  AND clase.relname IN (
    'network_agent_jobs_retention_idx',
    'network_agent_jobs_company_type_created_idx',
    'network_agent_jobs_pending_claim_idx',
    'network_device_status_events_job_idx'
  )
ORDER BY clase.relname;

ANALYZE public.network_agent_jobs;
ANALYZE public.network_device_status_events;
