import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  NETWORK_JOB_DISPATCHED_STALE_MS,
  NETWORK_JOB_RUNNING_STALE_MS,
  NETWORK_JOB_STALE_DISPATCHED_ERROR,
  NETWORK_JOB_STALE_RUNNING_ERROR,
} from "../lib/network/constants.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function functionSource(source, name) {
  const exported = `export async function ${name}`
  const local = `async function ${name}`
  const exportStart = source.indexOf(exported)
  const start = exportStart !== -1 ? exportStart : source.indexOf(local)
  assert.notEqual(start, -1, `no se encontró ${name}`)
  const from = source.slice(start)
  const nextExport = from.indexOf("\nexport async function ", 1)
  const nextLocal = from.indexOf("\nasync function ", 1)
  const cuts = [nextExport, nextLocal].filter((index) => index !== -1)
  const next = cuts.length === 0 ? -1 : Math.min(...cuts)
  return next === -1 ? from : from.slice(0, next)
}

function isoMinutesAgo(nowMs, minutes) {
  return new Date(nowMs - minutes * 60 * 1000).toISOString()
}

function applyStaleRecovery(jobs, nowMs) {
  const dispatchedCutoff = nowMs - NETWORK_JOB_DISPATCHED_STALE_MS
  const runningCutoff = nowMs - NETWORK_JOB_RUNNING_STALE_MS
  const completedAt = new Date(nowMs).toISOString()

  return jobs.map((job) => {
    if (job.completed_at != null || job.deleted_at != null) return job

    if (
      job.status === "dispatched" &&
      job.dispatched_at != null &&
      Date.parse(job.dispatched_at) <= dispatchedCutoff
    ) {
      return {
        ...job,
        status: "failed",
        error_message: NETWORK_JOB_STALE_DISPATCHED_ERROR,
        completed_at: completedAt,
      }
    }

    if (
      job.status === "running" &&
      job.started_at != null &&
      Date.parse(job.started_at) <= runningCutoff
    ) {
      return {
        ...job,
        status: "failed",
        error_message: NETWORK_JOB_STALE_RUNNING_ERROR,
        completed_at: completedAt,
      }
    }

    return job
  })
}

function casUpdateWhere(jobs, predicate, patch) {
  let changed = 0
  const next = jobs.map((job) => {
    if (!predicate(job)) return job
    changed += 1
    return { ...job, ...patch }
  })
  return { jobs: next, changed }
}

const queries = read("lib/network/jobs/queries.ts")
const execution = read("lib/network/jobs/agent-execution.ts")
const recoverSource = functionSource(queries, "recoverStaleNetworkAgentJobs")
const startSource = functionSource(queries, "markNetworkAgentJobRunning")
const completeSource = functionSource(queries, "completeNetworkAgentJob")
const claimSource = functionSource(execution, "claimAuthorizedNetworkAgentJob")
const enqueueSource = functionSource(execution, "claimOrEnqueueAuthorizedJob")
const monitoringResult = functionSource(execution, "submitNetworkMonitoringJobResult")
const discoveryResult = functionSource(execution, "submitNetworkDiscoveryJobResult")
const inflightSource = functionSource(
  read("lib/network/monitoring/queries.ts"),
  "findInflightMonitoringJobForDevice"
)
const dueSource = functionSource(
  read("lib/network/monitoring/queries.ts"),
  "findDueMonitoringDevice"
)

test("umbrales de stale son 2 minutos dispatched y 10 minutos running", () => {
  assert.equal(NETWORK_JOB_DISPATCHED_STALE_MS, 2 * 60 * 1000)
  assert.equal(NETWORK_JOB_RUNNING_STALE_MS, 10 * 60 * 1000)
  assert.equal(
    NETWORK_JOB_STALE_DISPATCHED_ERROR,
    "Job abandonado después del claim"
  )
  assert.equal(
    NETWORK_JOB_STALE_RUNNING_ERROR,
    "Job abandonado durante la ejecución"
  )
})

test("recovery usa UPDATE atómico por estado, no requeue ni loops N+1", () => {
  assert.match(recoverSource, /NETWORK_JOB_DISPATCHED_STALE_MS/)
  assert.match(recoverSource, /NETWORK_JOB_RUNNING_STALE_MS/)
  assert.match(recoverSource, /\.eq\("status", "dispatched"\)/)
  assert.match(recoverSource, /\.eq\("status", "running"\)/)
  assert.match(recoverSource, /\.lte\("dispatched_at", dispatchedCutoff\)/)
  assert.match(recoverSource, /\.lte\("started_at", runningCutoff\)/)
  assert.match(recoverSource, /\.is\("completed_at", null\)/)
  assert.match(recoverSource, /\.is\("deleted_at", null\)/)
  assert.match(recoverSource, /status: "failed"/)
  assert.match(recoverSource, /NETWORK_JOB_STALE_DISPATCHED_ERROR/)
  assert.match(recoverSource, /NETWORK_JOB_STALE_RUNNING_ERROR/)
  assert.doesNotMatch(recoverSource, /pending/)
  assert.doesNotMatch(recoverSource, /status: "cancelled"/)
  assert.doesNotMatch(recoverSource, /for \(/)
  assert.doesNotMatch(recoverSource, /for await/)
  assert.doesNotMatch(recoverSource, /\.select\("\*"\)/)
  assert.match(recoverSource, /\.select\("id"\)/)
  assert.equal((recoverSource.match(/\.update\(/g) ?? []).length, 2)
})

test("1-8: fresco no cambia; stale dispatched/running → failed; terminal no se toca; nunca pending", () => {
  const now = Date.parse("2026-08-30T16:00:00.000Z")
  const jobs = [
    {
      id: "fresh-dispatched",
      status: "dispatched",
      dispatched_at: isoMinutesAgo(now, 1),
      started_at: null,
      completed_at: null,
      deleted_at: null,
    },
    {
      id: "stale-dispatched",
      status: "dispatched",
      dispatched_at: isoMinutesAgo(now, 3),
      started_at: null,
      completed_at: null,
      deleted_at: null,
      payload: { deviceId: "dev-1" },
    },
    {
      id: "fresh-running",
      status: "running",
      dispatched_at: isoMinutesAgo(now, 20),
      started_at: isoMinutesAgo(now, 4),
      completed_at: null,
      deleted_at: null,
    },
    {
      id: "stale-running",
      status: "running",
      dispatched_at: isoMinutesAgo(now, 20),
      started_at: isoMinutesAgo(now, 11),
      completed_at: null,
      deleted_at: null,
      payload: { deviceId: "dev-1" },
    },
    {
      id: "completed",
      status: "completed",
      dispatched_at: isoMinutesAgo(now, 30),
      started_at: isoMinutesAgo(now, 30),
      completed_at: isoMinutesAgo(now, 29),
      deleted_at: null,
    },
    {
      id: "failed",
      status: "failed",
      dispatched_at: isoMinutesAgo(now, 30),
      started_at: isoMinutesAgo(now, 30),
      completed_at: isoMinutesAgo(now, 29),
      deleted_at: null,
    },
    {
      id: "cancelled",
      status: "cancelled",
      dispatched_at: isoMinutesAgo(now, 30),
      started_at: isoMinutesAgo(now, 30),
      completed_at: isoMinutesAgo(now, 29),
      deleted_at: null,
    },
  ]

  const recovered = applyStaleRecovery(jobs, now)
  const byId = Object.fromEntries(recovered.map((job) => [job.id, job]))

  assert.equal(byId["fresh-dispatched"].status, "dispatched")
  assert.equal(byId["fresh-running"].status, "running")
  assert.equal(byId["stale-dispatched"].status, "failed")
  assert.equal(
    byId["stale-dispatched"].error_message,
    NETWORK_JOB_STALE_DISPATCHED_ERROR
  )
  assert.equal(byId["stale-running"].status, "failed")
  assert.equal(
    byId["stale-running"].error_message,
    NETWORK_JOB_STALE_RUNNING_ERROR
  )
  assert.equal(byId.completed.status, "completed")
  assert.equal(byId.failed.status, "failed")
  assert.equal(byId.cancelled.status, "cancelled")
  assert.equal(
    recovered.every((job) => job.status !== "pending"),
    true
  )
  assert.deepEqual(byId["stale-dispatched"].payload, { deviceId: "dev-1" })
  assert.deepEqual(byId["stale-running"].id, "stale-running")
})

test("9: /start tardío sobre failed no vuelve a running", () => {
  assert.match(startSource, /\.in\("status", \["dispatched", "pending"\]\)/)
  assert.doesNotMatch(startSource, /"failed"/)
  assert.match(startSource, /status: "running"/)
  const startJob = functionSource(execution, "startAuthorizedNetworkAgentJob")
  assert.match(startJob, /markNetworkAgentJobRunning/)
  assert.doesNotMatch(startJob, /status: "running"/)
})

test("10: /result tardío sobre failed no persiste snapshot", () => {
  for (const source of [monitoringResult, discoveryResult]) {
    const terminalAt = source.indexOf('["completed", "failed", "cancelled"]')
    assert.notEqual(terminalAt, -1)
    assert.match(source, /El job ya fue finalizado/)
    const persistAt = Math.max(
      source.indexOf("persistMonitoringSnapshot"),
      source.indexOf("persistDiscoverySnapshot")
    )
    assert.ok(persistAt > terminalAt, "persistir solo después del chequeo terminal")
  }
  assert.match(completeSource, /\.in\("status", \["pending", "dispatched", "running"\]\)/)
  assert.doesNotMatch(
    completeSource,
    /\.in\("status", \[[^\]]*failed/
  )
})

test("11: after stale failed, Monitoring puede crear un job nuevo", () => {
  assert.match(inflightSource, /\.in\("status", \["pending", "dispatched", "running"\]\)/)
  assert.doesNotMatch(inflightSource, /"failed"/)
  assert.match(dueSource, /\.in\("status", \["pending", "dispatched", "running"\]\)/)
  assert.doesNotMatch(dueSource, /"failed"/)
  assert.match(enqueueSource, /findDueMonitoringDevice/)
  assert.match(enqueueSource, /MONITORING_EXECUTABLE_JOB_TYPE/)
  assert.match(enqueueSource, /createPendingNetworkAgentJob/)
  const recoverAt = claimSource.indexOf("recoverStaleNetworkAgentJobs")
  const enqueueAt = claimSource.indexOf("claimOrEnqueueAuthorizedJob")
  assert.ok(recoverAt !== -1 && enqueueAt > recoverAt)
})

test("12: Discovery stale no genera automáticamente otro Discovery job", () => {
  assert.match(enqueueSource, /MONITORING_EXECUTABLE_JOB_TYPE/)
  assert.doesNotMatch(enqueueSource, /DISCOVERY_EXECUTABLE_JOB_TYPE/)
  assert.doesNotMatch(enqueueSource, /jobType: "discovery"/)
  assert.match(enqueueSource, /jobType: MONITORING_EXECUTABLE_JOB_TYPE/)
})

test("13: UPDATE con status en WHERE evita double recovery concurrente", () => {
  const now = Date.parse("2026-08-30T16:00:00.000Z")
  const stale = {
    id: "job-a",
    status: "dispatched",
    dispatched_at: isoMinutesAgo(now, 5),
    started_at: null,
    completed_at: null,
    deleted_at: null,
  }

  const first = casUpdateWhere(
    [stale],
    (job) =>
      job.status === "dispatched" &&
      job.completed_at == null &&
      job.deleted_at == null &&
      Date.parse(job.dispatched_at) <= now - NETWORK_JOB_DISPATCHED_STALE_MS,
    {
      status: "failed",
      error_message: NETWORK_JOB_STALE_DISPATCHED_ERROR,
      completed_at: new Date(now).toISOString(),
    }
  )
  const second = casUpdateWhere(
    first.jobs,
    (job) =>
      job.status === "dispatched" &&
      job.completed_at == null &&
      job.deleted_at == null &&
      Date.parse(job.dispatched_at) <= now - NETWORK_JOB_DISPATCHED_STALE_MS,
    {
      status: "failed",
      error_message: NETWORK_JOB_STALE_DISPATCHED_ERROR,
      completed_at: new Date(now).toISOString(),
    }
  )

  assert.equal(first.changed, 1)
  assert.equal(second.changed, 0)
  assert.equal(second.jobs[0].status, "failed")
  assert.match(recoverSource, /\.eq\("status", "dispatched"\)/)
  assert.match(recoverSource, /\.eq\("status", "running"\)/)
})

test("14: recovery failure no bloquea claim", () => {
  const recoverAt = claimSource.indexOf("recoverStaleNetworkAgentJobs")
  const catchAt = claimSource.indexOf("catch (error)")
  const enqueueAt = claimSource.indexOf("claimOrEnqueueAuthorizedJob")
  assert.ok(recoverAt !== -1 && catchAt > recoverAt && enqueueAt > catchAt)
  assert.match(claimSource, /job recovery failed/)
  assert.doesNotMatch(claimSource, /throw error/)
  assert.match(read("app/api/network/v1/jobs/route.ts"), /claimAuthorizedNetworkAgentJob/)
})

test("recovery no loguea cada GET /jobs; Agent y Discovery no se tocan", () => {
  assert.match(recoverSource, /dispatched=\$\{dispatched\} running=\$\{running\}/)
  assert.match(recoverSource, /if \(dispatched \+ running > 0\)/)
  assert.doesNotMatch(recoverSource, /payload/)
  assert.doesNotMatch(read("network-agent/src/index.ts"), /recoverStaleNetworkAgentJobs/)
  assert.doesNotMatch(read("network-agent/src/cloud-client.ts"), /recoverStaleNetworkAgentJobs/)
  assert.doesNotMatch(
    read("lib/network/discovery/parse-snapshot.ts"),
    /recoverStaleNetworkAgentJobs/
  )
})
