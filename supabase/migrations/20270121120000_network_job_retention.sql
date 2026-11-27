-- Retención por lotes de network_agent_jobs.
-- No crea índices: CREATE INDEX CONCURRENTLY vive en scripts/network-retention-indexes.sql.
-- No modifica inventario, agents, destinos, credenciales ni el estado actual.

CREATE OR REPLACE FUNCTION public.network_agent_job_target_key(
  p_payload jsonb,
  p_result jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN chosen IS NULL THEN NULL
    ELSE 'target:' || chosen
  END
  FROM (
    SELECT COALESCE(
      CASE
        WHEN NULLIF(btrim(p_payload ->> 'targetId'), '') IS NOT NULL
         AND lower(btrim(p_payload ->> 'targetId')) <> 'unknown'
        THEN btrim(p_payload ->> 'targetId')
      END,
      CASE
        WHEN NULLIF(btrim(p_result ->> 'targetId'), '') IS NOT NULL
         AND lower(btrim(p_result ->> 'targetId')) <> 'unknown'
        THEN btrim(p_result ->> 'targetId')
      END
    ) AS chosen
  ) AS extracted
$$;

CREATE OR REPLACE FUNCTION public.network_purge_expired_jobs(
  p_captured_at timestamptz,
  p_class text,
  p_limit integer DEFAULT 500,
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE (
  retention_class text,
  jobs_deleted integer,
  events_deleted integer,
  applied boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit integer;
  v_cutoff timestamptz;
  v_candidates uuid[];
  v_ids uuid[];
  v_events integer;
  v_jobs integer;
BEGIN
  IF p_captured_at IS NULL
     OR p_class IS NULL
     OR p_class NOT IN (
       'monitoring_completed',
       'monitoring_failed',
       'discovery',
       'diagnostic'
     )
  THEN
    RAISE EXCEPTION 'clase o fecha de retencion invalida'
      USING ERRCODE = '22023';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500);
  v_cutoff := CASE p_class
    WHEN 'monitoring_completed' THEN p_captured_at - interval '24 hours'
    WHEN 'monitoring_failed' THEN p_captured_at - interval '7 days'
    ELSE p_captured_at - interval '30 days'
  END;

  SELECT COALESCE(array_agg(picked.id ORDER BY picked.aged_at, picked.id), '{}')
    INTO v_candidates
  FROM (
    SELECT
      job.id,
      COALESCE(job.completed_at, job.created_at) AS aged_at
    FROM public.network_agent_jobs AS job
    WHERE job.status IN ('completed', 'failed', 'cancelled')
      AND COALESCE(job.completed_at, job.created_at) < v_cutoff
      AND (
        (
          p_class = 'monitoring_completed'
          AND job.job_type = 'monitoring'
          AND job.status = 'completed'
        )
        OR (
          p_class = 'monitoring_failed'
          AND job.job_type = 'monitoring'
          AND job.status IN ('failed', 'cancelled')
        )
        OR (
          p_class IN ('discovery', 'diagnostic')
          AND job.job_type = p_class
          AND public.network_agent_job_target_key(job.payload, job.result) IS NOT NULL
          AND NOT (
            job.status = 'completed'
            AND NOT EXISTS (
              SELECT 1
              FROM public.network_agent_jobs AS newer
              WHERE newer.company_id = job.company_id
                AND newer.job_type = job.job_type
                AND newer.status = 'completed'
                AND public.network_agent_job_target_key(newer.payload, newer.result)
                  = public.network_agent_job_target_key(job.payload, job.result)
                AND (
                  COALESCE(newer.completed_at, newer.created_at)
                    > COALESCE(job.completed_at, job.created_at)
                  OR (
                    COALESCE(newer.completed_at, newer.created_at)
                      = COALESCE(job.completed_at, job.created_at)
                    AND newer.id > job.id
                  )
                )
            )
          )
        )
      )
    ORDER BY COALESCE(job.completed_at, job.created_at), job.id
    LIMIT v_limit
  ) AS picked;

  IF COALESCE(p_dry_run, false) THEN
    SELECT count(*)::integer
      INTO v_events
    FROM public.network_device_status_events AS event
    WHERE event.job_id = ANY(v_candidates);

    retention_class := p_class;
    jobs_deleted := cardinality(v_candidates);
    events_deleted := COALESCE(v_events, 0);
    applied := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(locked.id), '{}')
    INTO v_ids
  FROM (
    SELECT job.id
    FROM public.network_agent_jobs AS job
    WHERE job.id = ANY(v_candidates)
      AND job.status IN ('completed', 'failed', 'cancelled')
    FOR UPDATE SKIP LOCKED
  ) AS locked;

  IF cardinality(v_ids) = 0 THEN
    retention_class := p_class;
    jobs_deleted := 0;
    events_deleted := 0;
    applied := true;
    RETURN NEXT;
    RETURN;
  END IF;

  DELETE FROM public.network_device_status_events
  WHERE job_id = ANY(v_ids);
  GET DIAGNOSTICS v_events = ROW_COUNT;

  DELETE FROM public.network_agent_jobs
  WHERE id = ANY(v_ids)
    AND status IN ('completed', 'failed', 'cancelled');
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  IF v_jobs <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'la retencion no elimino el lote completo';
  END IF;

  retention_class := p_class;
  jobs_deleted := v_jobs;
  events_deleted := v_events;
  applied := true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.network_agent_job_target_key(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_purge_expired_jobs(timestamptz, text, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_agent_job_target_key(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.network_purge_expired_jobs(timestamptz, text, integer, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.network_agent_job_target_key(jsonb, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.network_purge_expired_jobs(timestamptz, text, integer, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_agent_job_target_key(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.network_purge_expired_jobs(timestamptz, text, integer, boolean) TO service_role;

COMMENT ON FUNCTION public.network_purge_expired_jobs(timestamptz, text, integer, boolean) IS
  'Borra un lote de jobs terminales vencidos y sus eventos. Conserva activos y el ultimo completed por empresa y targetId.';
