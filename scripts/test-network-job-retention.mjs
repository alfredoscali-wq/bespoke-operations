import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { networkTimestampMinus } from "../lib/network/discovery/latest-run.ts"
import {
  isNetworkRetentionCronAuthorized,
  networkJobTargetKey,
  runNetworkJobRetention,
  selectExpiredNetworkJobIds,
} from "../lib/network/jobs/retention.ts"

const root = resolve(import.meta.dirname, "..")
const CAPTURED = "2026-11-26T18:00:00.000000+00:00"
const COMPANY_A = "00000000-0000-4000-8000-00000000000a"
const COMPANY_B = "00000000-0000-4000-8000-00000000000b"

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function jobId(n) {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`
}

function job(overrides) {
  return {
    id: jobId(1),
    companyId: COMPANY_A,
    jobType: "discovery",
    status: "completed",
    createdAt: "2026-10-01T18:00:00.000000+00:00",
    completedAt: "2026-10-01T18:00:00.000000+00:00",
    payloadTargetId: "target-a",
    resultTargetId: null,
    ...overrides,
  }
}

test("la resta de timestamps conserva microsegundos y el huso", () => {
  assert.equal(
    networkTimestampMinus("1970-01-01T00:00:00Z", 0),
    "1970-01-01T00:00:00+00:00"
  )
  assert.equal(
    networkTimestampMinus("2026-11-26T15:00:00.000002-03:00", 0),
    "2026-11-26T18:00:00.000002+00:00"
  )
  assert.equal(
    networkTimestampMinus("2026-11-26T18:00:00.000002+00:00", 24 * 60 * 60),
    "2026-11-25T18:00:00.000002+00:00"
  )
})

test("un microsegundo conserva el Discovery completado más reciente aunque su id sea menor", () => {
  const jobs = [
    job({
      id: jobId(20),
      completedAt: "2026-10-01T18:00:00.000001+00:00",
      createdAt: "2026-10-01T18:00:00.000001+00:00",
      payloadTargetId: "target-core",
    }),
    job({
      id: jobId(3),
      completedAt: "2026-10-01T18:00:00.000002+00:00",
      createdAt: "2026-10-01T18:00:00.000002+00:00",
      payloadTargetId: "target-core",
    }),
  ]
  assert.equal(jobs[0].payloadTargetId, jobs[1].payloadTargetId)
  const expired = selectExpiredNetworkJobIds(jobs, {
    capturedAt: CAPTURED,
    retentionClass: "discovery",
  })
  assert.deepEqual(expired, [jobId(20)])
})

test("el mismo timestamp conserva el id mayor", () => {
  const same = "2026-10-01T18:00:00.500000+00:00"
  const jobs = [
    job({ id: jobId(2), completedAt: same, createdAt: same, payloadTargetId: "target-core" }),
    job({ id: jobId(9), completedAt: same, createdAt: same, payloadTargetId: "target-core" }),
  ]
  assert.deepEqual(
    selectExpiredNetworkJobIds(jobs, {
      capturedAt: CAPTURED,
      retentionClass: "discovery",
    }),
    [jobId(2)]
  )
  assert.deepEqual(
    selectExpiredNetworkJobIds([...jobs].reverse(), {
      capturedAt: CAPTURED,
      retentionClass: "discovery",
    }),
    [jobId(2)]
  )
})

test("dos empresas con el mismo targetId no comparten el último resultado", () => {
  const jobs = [
    job({
      id: jobId(1),
      companyId: COMPANY_A,
      completedAt: "2026-10-01T18:00:00.000001+00:00",
      createdAt: "2026-10-01T18:00:00.000001+00:00",
      payloadTargetId: "target-shared",
    }),
    job({
      id: jobId(2),
      companyId: COMPANY_A,
      completedAt: "2026-10-20T18:00:00.000001+00:00",
      createdAt: "2026-10-20T18:00:00.000001+00:00",
      payloadTargetId: "target-shared",
    }),
    job({
      id: jobId(3),
      companyId: COMPANY_B,
      completedAt: "2026-09-01T18:00:00.000001+00:00",
      createdAt: "2026-09-01T18:00:00.000001+00:00",
      payloadTargetId: "target-shared",
    }),
  ]
  assert.deepEqual(
    selectExpiredNetworkJobIds(jobs, {
      capturedAt: CAPTURED,
      retentionClass: "discovery",
    }),
    [jobId(1)]
  )
})

test("el mismo host con distinto targetId conserva ambos destinos", () => {
  const jobs = [
    job({
      id: jobId(1),
      payloadTargetId: "target-site-a",
      resultTargetId: null,
      completedAt: "2026-10-01T18:00:00.000000+00:00",
    }),
    job({
      id: jobId(2),
      payloadTargetId: "target-site-b",
      resultTargetId: null,
      completedAt: "2026-10-01T18:00:00.000000+00:00",
    }),
  ]
  assert.equal(networkJobTargetKey(jobs[0]), "target:target-site-a")
  assert.equal(networkJobTargetKey(jobs[1]), "target:target-site-b")
  assert.deepEqual(
    selectExpiredNetworkJobIds(jobs, {
      capturedAt: CAPTURED,
      retentionClass: "discovery",
    }),
    []
  )
})

test("sin targetId válido el trabajo se conserva", () => {
  const jobs = [
    job({ id: jobId(1), payloadTargetId: null, resultTargetId: null }),
    job({ id: jobId(2), payloadTargetId: "  ", resultTargetId: "unknown" }),
    job({ id: jobId(3), payloadTargetId: "unknown", resultTargetId: "target-from-result" }),
  ]
  assert.equal(networkJobTargetKey(jobs[0]), null)
  assert.equal(networkJobTargetKey(jobs[1]), null)
  assert.equal(networkJobTargetKey(jobs[2]), "target:target-from-result")
  assert.deepEqual(
    selectExpiredNetworkJobIds(jobs, {
      capturedAt: CAPTURED,
      retentionClass: "discovery",
    }),
    []
  )
})

test("los estados activos no se eliminan y el último completado se conserva", () => {
  const jobs = [
    job({
      id: jobId(1),
      jobType: "diagnostic",
      status: "pending",
      completedAt: "2026-01-01T00:00:00.000000+00:00",
      payloadTargetId: "target-core",
    }),
    job({
      id: jobId(2),
      jobType: "diagnostic",
      status: "dispatched",
      payloadTargetId: "target-core",
    }),
    job({
      id: jobId(3),
      jobType: "diagnostic",
      status: "running",
      deletedAt: "2026-10-02T00:00:00.000000+00:00",
      payloadTargetId: "target-core",
    }),
    job({
      id: jobId(4),
      jobType: "diagnostic",
      status: "failed",
      completedAt: "2026-10-01T18:00:00.000000+00:00",
      deletedAt: "2026-10-02T00:00:00.000000+00:00",
      payloadTargetId: "target-core",
    }),
    job({
      id: jobId(5),
      jobType: "diagnostic",
      status: "completed",
      completedAt: "2026-09-01T18:00:00.000000+00:00",
      payloadTargetId: "target-core",
    }),
    job({
      id: jobId(6),
      jobType: "diagnostic",
      status: "completed",
      completedAt: "2026-10-15T18:00:00.000000+00:00",
      payloadTargetId: "target-core",
    }),
    job({
      id: jobId(7),
      jobType: "monitoring",
      status: "completed",
      completedAt: "2026-11-26T17:00:00.000000+00:00",
      payloadTargetId: null,
    }),
    job({
      id: jobId(8),
      jobType: "monitoring",
      status: "completed",
      completedAt: "2026-11-20T18:00:00.000000+00:00",
      deletedAt: "2026-11-21T18:00:00.000000+00:00",
      payloadTargetId: null,
    }),
  ]
  assert.deepEqual(
    selectExpiredNetworkJobIds(jobs, {
      capturedAt: CAPTURED,
      retentionClass: "diagnostic",
    }),
    [jobId(5), jobId(4)]
  )
  assert.deepEqual(
    selectExpiredNetworkJobIds(jobs, {
      capturedAt: CAPTURED,
      retentionClass: "monitoring_completed",
    }),
    [jobId(8)]
  )
  assert.deepEqual(
    selectExpiredNetworkJobIds(jobs, {
      capturedAt: CAPTURED,
      retentionClass: "monitoring_failed",
    }),
    []
  )
})

test("el cron solo acepta Bearer y corta por error o por tiempo", async () => {
  assert.equal(isNetworkRetentionCronAuthorized("Bearer secreto", "secreto"), true)
  assert.equal(isNetworkRetentionCronAuthorized("secreto", "secreto"), false)
  assert.equal(isNetworkRetentionCronAuthorized(null, "secreto"), false)
  assert.equal(isNetworkRetentionCronAuthorized("Bearer secreto", null), false)

  const route = read("app/api/cron/network-job-retention/route.ts")
  assert.match(route, /export const maxDuration = 60/)
  assert.doesNotMatch(route, /searchParams/)
  assert.match(route, /p_dry_run: false/)
  assert.match(read("vercel.json"), /"path": "\/api\/cron\/network-job-retention"/)
  assert.match(read("vercel.json"), /"schedule": "0 \* \* \* \*"/)
  assert.match(read("vercel.json"), /weekly-report/)
  assert.match(read("vercel.json"), /activate-projects/)

  const calls = []
  let clock = 0
  const budget = await runNetworkJobRetention({
    capturedAt: CAPTURED,
    now: () => clock,
    purge: async (retentionClass) => {
      calls.push(retentionClass)
      clock = 40_000
      return { jobsDeleted: 1, eventsDeleted: 0 }
    },
  })
  assert.equal(budget.ok, true)
  assert.equal(budget.completed, false)
  assert.equal(budget.stoppedReason, "time_budget")
  assert.deepEqual(calls, ["monitoring_completed"])

  const failed = await runNetworkJobRetention({
    capturedAt: CAPTURED,
    purge: async (retentionClass) => {
      if (retentionClass === "monitoring_failed") {
        throw new Error("lote interrumpido")
      }
      return { jobsDeleted: 0, eventsDeleted: 0 }
    },
  })
  assert.equal(failed.ok, false)
  assert.equal(failed.stoppedReason, "error")
  assert.equal(failed.message, "lote interrumpido")
  assert.deepEqual(
    failed.results.map((result) => result.retentionClass),
    ["monitoring_completed"]
  )
})

test("la función SQL es invoker, por lotes y no usa host ni definidor", () => {
  const sql = read("supabase/migrations/20270121120000_network_job_retention.sql")
  assert.match(sql, /FUNCTION public\.network_purge_expired_jobs/)
  assert.match(sql, /SECURITY INVOKER/)
  assert.match(sql, /SET search_path = pg_catalog, public/)
  assert.doesNotMatch(sql, /SECURITY DEFINER/)
  assert.match(sql, /LEAST\(GREATEST\(COALESCE\(p_limit, 500\), 1\), 500\)/)
  assert.match(sql, /interval '24 hours'/)
  assert.match(sql, /interval '7 days'/)
  assert.match(sql, /interval '30 days'/)
  assert.match(sql, /DELETE FROM public\.network_device_status_events/)
  assert.match(sql, /DELETE FROM public\.network_agent_jobs/)
  assert.match(sql, /FOR UPDATE SKIP LOCKED/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.network_purge_expired_jobs/)
  assert.match(sql, /FROM anon/)
  assert.match(sql, /FROM authenticated/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.network_purge_expired_jobs[\s\S]*TO service_role/)
  assert.doesNotMatch(sql, /->> 'host'/)
  assert.match(sql, /'unknown'/)
  assert.match(sql, /newer\.company_id = job\.company_id/)
  assert.match(sql, /newer\.id > job\.id/)

  const indexes = read("scripts/network-retention-indexes.sql")
  assert.match(indexes, /CREATE INDEX CONCURRENTLY network_agent_jobs_retention_idx/)
  assert.match(indexes, /CREATE INDEX CONCURRENTLY network_agent_jobs_company_type_created_idx/)
  assert.match(indexes, /CREATE INDEX CONCURRENTLY network_agent_jobs_pending_claim_idx/)
  assert.match(indexes, /CREATE INDEX CONCURRENTLY network_device_status_events_job_idx/)
  assert.match(indexes, /indice\.indisvalid/)
  assert.match(indexes, /ANALYZE public\.network_agent_jobs/)
  assert.doesNotMatch(indexes, /^\s*VACUUM\s+FULL\b/m)
  assert.doesNotMatch(indexes, /^\s*BEGIN\b/m)
})
