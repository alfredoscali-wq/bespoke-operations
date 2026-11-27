import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { pickLatestCompletedDiscoveryJobForHost } from "../lib/network/discovery/latest-run.ts"
import {
  listNetworkAgentJobs,
  listNetworkDiscoveryJobs,
  listTopologyJobHistory,
} from "../lib/network/jobs/queries.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const AGENT = "00000000-0000-4000-8000-0000000000aa"
const BASE_MS = Date.parse("2026-11-26T18:00:00.000Z")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function jobId(n) {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`
}

function stamp(rank) {
  const ms = BASE_MS + Math.floor(rank / 1000)
  const micros = rank % 1000
  const iso = new Date(ms).toISOString()
  return `${iso.slice(0, -1)}${String(micros).padStart(3, "0")}+00:00`
}

function historyRow({
  id,
  jobType,
  createdAt,
  host,
  deletedAt = null,
  agentId = AGENT,
}) {
  return {
    id,
    company_id: COMPANY,
    agent_id: agentId,
    site_id: null,
    job_type: jobType,
    status: "completed",
    error_message: null,
    dispatched_at: null,
    started_at: createdAt,
    completed_at: createdAt,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: deletedAt,
    payload_target_id: "target-1",
    payload_device_id: null,
    payload_host: host,
    payload_target_name: "Core",
    payload_site_id: null,
    result_target_id: "target-1",
    result_device_count: "4",
    result_primary_ip: host,
    result_host: host,
    network_agents: { name: "ABNet" },
  }
}

function compareValues(left, right) {
  if (left === right) return 0
  if (left < right) return -1
  return 1
}

function applyQuery(rows, state) {
  let result = rows.filter((row) =>
    state.filters.every((filter) => {
      if (filter.op === "eq") return row[filter.column] === filter.value
      if (filter.op === "in") return filter.value.includes(row[filter.column])
      if (filter.op === "is") return row[filter.column] === filter.value
      return false
    })
  )
  if (state.orders.length > 0) {
    result = [...result].sort((left, right) => {
      for (const order of state.orders) {
        const compared = compareValues(left[order.column], right[order.column])
        if (compared !== 0) return order.ascending ? compared : -compared
      }
      return 0
    })
  }
  if (state.limit != null) result = result.slice(0, state.limit)
  return result
}

function createJobClient(rows) {
  const calls = []
  return {
    calls,
    from() {
      const state = {
        select: null,
        filters: [],
        orders: [],
        limit: null,
      }
      const api = {
        select(columns) {
          state.select = columns
          return api
        },
        eq(column, value) {
          state.filters.push({ op: "eq", column, value })
          return api
        },
        in(column, value) {
          state.filters.push({ op: "in", column, value })
          return api
        },
        is(column, value) {
          state.filters.push({ op: "is", column, value })
          return api
        },
        order(column, options) {
          state.orders.push({
            column,
            ascending: options?.ascending !== false,
          })
          return api
        },
        limit(value) {
          state.limit = value
          return api
        },
        then(onFulfilled, onRejected) {
          calls.push(state)
          return Promise.resolve({
            data: applyQuery(rows, state),
            error: null,
          }).then(onFulfilled, onRejected)
        },
      }
      return api
    },
  }
}

function jobTypeCall(calls, jobTypes) {
  return calls.find((call) =>
    call.filters.some(
      (filter) =>
        filter.op === "in" &&
        filter.column === "job_type" &&
        filter.value.length === jobTypes.length &&
        jobTypes.every((jobType) => filter.value.includes(jobType))
    )
  )
}

function assertPostgresHistoryOrder(call) {
  assert.ok(call)
  assert.deepEqual(call.orders, [
    { column: "created_at", ascending: false },
    { column: "id", ascending: false },
  ])
  assert.equal(call.limit, 100)
  assert.equal(
    call.filters.some(
      (filter) => filter.op === "is" && filter.column === "deleted_at"
    ),
    true
  )
}

test("Topology ordena Discovery y Diagnostic con la misma fecha por id en PostgreSQL", async () => {
  const same = "2026-11-26T18:00:00.500000+00:00"
  const rows = [
    historyRow({
      id: jobId(1),
      jobType: "discovery",
      createdAt: same,
      host: "10.1.0.1",
    }),
    historyRow({
      id: jobId(2),
      jobType: "discovery",
      createdAt: same,
      host: "10.1.0.2",
    }),
    historyRow({
      id: jobId(3),
      jobType: "diagnostic",
      createdAt: same,
      host: "10.1.0.3",
    }),
  ]
  const client = createJobClient(rows)
  const history = await listTopologyJobHistory(client, COMPANY)
  const management = jobTypeCall(client.calls, ["discovery", "diagnostic"])
  const discovery = jobTypeCall(client.calls, ["discovery"])

  assertPostgresHistoryOrder(management)
  assertPostgresHistoryOrder(discovery)
  assert.deepEqual(
    history.managementJobs.map((job) => job.id),
    [jobId(3), jobId(2), jobId(1)]
  )
  assert.deepEqual(history.managementJobs.map((job) => job.jobType), [
    "diagnostic",
    "discovery",
    "discovery",
  ])
  assert.deepEqual(
    history.discoveryJobs.map((job) => job.id),
    [jobId(2), jobId(1)]
  )
  assert.equal(history.managementJobs[0].payload.host, "10.1.0.3")
  assert.equal(history.managementJobs[0].result.deviceCount, 4)
})

test("fechas distintas por microsegundos ganan al id", async () => {
  const older = "2026-11-26T18:00:00.000001+00:00"
  const newer = "2026-11-26T18:00:00.000002+00:00"
  assert.equal(Date.parse(older), Date.parse(newer))
  const rows = [
    historyRow({
      id: jobId(10),
      jobType: "discovery",
      createdAt: older,
      host: "10.2.0.10",
    }),
    historyRow({
      id: jobId(11),
      jobType: "diagnostic",
      createdAt: older,
      host: "10.2.0.11",
    }),
    historyRow({
      id: jobId(4),
      jobType: "diagnostic",
      createdAt: newer,
      host: "10.2.0.4",
    }),
    historyRow({
      id: jobId(5),
      jobType: "discovery",
      createdAt: newer,
      host: "10.2.0.5",
    }),
  ]
  const client = createJobClient(rows)
  const history = await listTopologyJobHistory(client, COMPANY)

  assert.deepEqual(
    history.managementJobs.map((job) => job.id),
    [jobId(5), jobId(4), jobId(11), jobId(10)]
  )
  assertPostgresHistoryOrder(
    jobTypeCall(client.calls, ["discovery", "diagnostic"])
  )
})

test("más de 100 jobs de cada tipo respetan el límite de PostgreSQL", async () => {
  const rows = []
  for (let rank = 1; rank <= 150; rank += 1) {
    rows.push(
      historyRow({
        id: jobId(rank),
        jobType: "discovery",
        createdAt: stamp(rank),
        host: `10.8.0.${rank}`,
      })
    )
  }
  for (let rank = 151; rank <= 300; rank += 1) {
    rows.push(
      historyRow({
        id: jobId(rank),
        jobType: "diagnostic",
        createdAt: stamp(rank),
        host: `10.8.1.${rank}`,
      })
    )
  }
  rows.push(
    historyRow({
      id: jobId(9000),
      jobType: "diagnostic",
      createdAt: stamp(4000),
      host: "10.9.9.9",
      deletedAt: sameDeleted(),
    })
  )

  const client = createJobClient(rows)
  const history = await listTopologyJobHistory(client, COMPANY)
  const management = jobTypeCall(client.calls, ["discovery", "diagnostic"])
  const discovery = jobTypeCall(client.calls, ["discovery"])
  assertPostgresHistoryOrder(management)
  assertPostgresHistoryOrder(discovery)
  assert.equal(client.calls.length, 2)

  assert.equal(history.managementJobs.length, 100)
  assert.equal(history.discoveryJobs.length, 100)
  assert.deepEqual(
    history.managementJobs.map((job) => job.id),
    Array.from({ length: 100 }, (_, index) => jobId(300 - index))
  )
  assert.ok(history.managementJobs.every((job) => job.jobType === "diagnostic"))
  assert.deepEqual(
    history.discoveryJobs.map((job) => job.id),
    Array.from({ length: 100 }, (_, index) => jobId(150 - index))
  )
  assert.ok(history.discoveryJobs.every((job) => job.jobType === "discovery"))
  assert.equal(
    history.managementJobs.some((job) => job.jobType === "discovery"),
    false
  )
  assert.equal(
    history.discoveryJobs.some((job) => job.id === jobId(50)),
    false
  )
})

test("las observaciones usan los 100 Discovery y no la lista combinada", async () => {
  const rows = []
  for (let rank = 1; rank <= 150; rank += 1) {
    rows.push(
      historyRow({
        id: jobId(rank),
        jobType: "discovery",
        createdAt: stamp(rank),
        host: `10.4.0.${rank}`,
      })
    )
  }
  for (let rank = 151; rank <= 300; rank += 1) {
    rows.push(
      historyRow({
        id: jobId(rank),
        jobType: "diagnostic",
        createdAt: stamp(rank),
        host: `10.4.1.${rank}`,
      })
    )
  }
  const client = createJobClient(rows)
  const history = await listTopologyJobHistory(client, COMPANY)
  const newestDiscovery = history.discoveryJobs[0]
  const oldestIncluded = history.discoveryJobs.at(-1)
  const excludedHost = "10.4.0.50"

  assert.equal(newestDiscovery.id, jobId(150))
  assert.equal(
    history.managementJobs.some((job) => job.id === newestDiscovery.id),
    false
  )
  assert.equal(oldestIncluded.id, jobId(51))
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(history.discoveryJobs, excludedHost),
    null
  )
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(
      history.discoveryJobs,
      oldestIncluded.targetHost
    )?.id,
    jobId(51)
  )
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(
      history.managementJobs,
      oldestIncluded.targetHost
    ),
    null
  )

  const topology = read("lib/network/topology/queries.ts")
  const observationStart = topology.indexOf("const jobs = jobHistory.discoveryJobs")
  const observationEnd = topology.indexOf(
    "getLatestNetworkDiscoveryObservationsByHosts",
    observationStart
  )
  assert.ok(observationStart !== -1 && observationEnd > observationStart)
  assert.doesNotMatch(
    topology.slice(observationStart, observationEnd),
    /managementJobs/
  )
})

test("el orden de Topology no se resuelve en JavaScript", () => {
  const source = read("lib/network/jobs/queries.ts")
  const history = source.slice(
    source.indexOf("export async function listTopologyJobHistory"),
    source.indexOf("export async function createPendingNetworkAgentJob")
  )
  assert.match(history, /listNetworkDiscoveryJobs/)
  assert.match(history, /listNetworkManagementJobs/)
  assert.doesNotMatch(history, /Date\.parse/)
  assert.doesNotMatch(history, /\.sort\(/)
  assert.doesNotMatch(history, /\.slice\(/)
  assert.doesNotMatch(history, /listNetworkDiagnosticJobs/)

  const listed = source.slice(
    source.indexOf("async function listHistoryJobs"),
    source.indexOf("export async function listNetworkAgentJobs")
  )
  assert.match(listed, /\.order\("created_at", \{ ascending: false \}\)/)
  assert.match(listed, /\.order\("id", \{ ascending: false \}\)/)
  assert.match(listed, /\.limit\(HISTORY_JOB_LIMIT\)/)
})

test("el listado del Agent no incluye payload ni result", async () => {
  const rows = Array.from({ length: 60 }, (_, index) => {
    const createdAt = stamp(index + 1)
    return {
      id: jobId(index + 1),
      company_id: COMPANY,
      agent_id: AGENT,
      site_id: null,
      job_type: "monitoring",
      status: "completed",
      error_message: "sin detalle",
      dispatched_at: null,
      started_at: createdAt,
      completed_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
      payload: { deviceId: "device-1", secret: "no-mostrar" },
      result: { status: "online" },
    }
  })
  rows.push({
    ...rows[0],
    id: jobId(61),
    agent_id: "00000000-0000-4000-8000-0000000000bb",
    created_at: stamp(900),
  })
  const client = createJobClient(rows)
  const jobs = await listNetworkAgentJobs(client, COMPANY, AGENT)
  const call = client.calls[0]

  assert.equal(jobs.length, 50)
  assert.equal(jobs[0].id, jobId(60))
  assert.equal(jobs.at(-1).id, jobId(11))
  assert.equal(jobs.some((job) => job.id === jobId(61)), false)
  for (const job of jobs) {
    assert.equal(Object.hasOwn(job, "payload"), false)
    assert.equal(Object.hasOwn(job, "result"), false)
    assert.equal(job.jobType, "monitoring")
    assert.equal(job.status, "completed")
  }
  assert.deepEqual(call.orders, [{ column: "created_at", ascending: false }])
  assert.equal(call.limit, 50)
  assert.doesNotMatch(call.select, /payload/)
  assert.doesNotMatch(call.select, /result/)

  const discoveryClient = createJobClient([
    historyRow({
      id: jobId(1),
      jobType: "discovery",
      createdAt: stamp(1),
      host: "10.5.0.1",
    }),
  ])
  const discoveryJobs = await listNetworkDiscoveryJobs(discoveryClient, COMPANY)
  assert.equal(discoveryJobs[0].payload.targetId, "target-1")
  assert.equal(discoveryJobs[0].result.deviceCount, 4)
  assert.equal(discoveryJobs[0].targetHost, "10.5.0.1")
})

test("la ejecución y los otros consumidores siguen leyendo el job completo", () => {
  const queries = read("lib/network/jobs/queries.ts")
  const execution = read("lib/network/jobs/agent-execution.ts")
  const screen = read("components/network/network-agents-screen.tsx")
  const monitoring = read("lib/network/monitoring/queries.ts")

  for (const name of [
    "export async function createPendingNetworkAgentJob",
    "export async function getNetworkAgentJob",
    "export async function claimNextPendingNetworkAgentJob",
    "export async function markNetworkAgentJobRunning",
    "export async function completeNetworkAgentJob",
  ]) {
    const start = queries.indexOf(name)
    assert.notEqual(start, -1)
    assert.match(queries.slice(start, start + 900), /\.select\("\*"\)/)
  }

  assert.doesNotMatch(execution, /listNetworkAgentJobs/)
  assert.match(execution, /getNetworkAgentJob/)
  assert.match(execution, /claimNextPendingNetworkAgentJob/)
  assert.match(monitoring, /\.select\("id, payload"\)/)
  assert.doesNotMatch(monitoring, /listNetworkAgentJobs/)
  assert.match(screen, /NetworkAgentJobListItem/)
  assert.match(screen, /NETWORK_JOB_TYPE_LABELS\[job\.jobType\]/)
  assert.match(screen, /job\.status/)
  assert.doesNotMatch(screen, /job\.payload/)
  assert.doesNotMatch(screen, /job\.result/)
})

function completedDiscovery({ id, host, completedAt }) {
  return {
    id,
    status: "completed",
    agentId: AGENT,
    startedAt: "2026-11-26T17:00:00.000000+00:00",
    completedAt,
    targetHost: host,
    payload: { host, targetId: "target-1" },
    result: { targetId: "target-1", primaryManagementIp: host },
  }
}

test("un microsegundo elige la Discovery más reciente aunque su id sea menor", () => {
  const older = "2026-11-26T18:00:00.000001+00:00"
  const newer = "2026-11-26T15:00:00.000002-03:00"
  const host = "10.7.0.1"
  const otherHost = "10.7.0.2"
  assert.equal(Date.parse(older), Date.parse("2026-11-26T18:00:00.000002+00:00"))
  const jobs = [
    completedDiscovery({ id: jobId(20), host, completedAt: older }),
    completedDiscovery({ id: jobId(3), host, completedAt: newer }),
    completedDiscovery({
      id: jobId(90),
      host: otherHost,
      completedAt: "2026-11-26T19:00:00.000000+00:00",
    }),
  ]

  const picked = pickLatestCompletedDiscoveryJobForHost(jobs, host)
  const other = pickLatestCompletedDiscoveryJobForHost(jobs, otherHost)
  assert.equal(picked?.id, jobId(3))
  assert.equal(picked?.targetHost, host)
  assert.equal(picked?.completedAt, newer)
  assert.equal(other?.id, jobId(90))
  assert.equal(other?.targetHost, otherHost)
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(jobs, "10.7.0.3"),
    null
  )

  const source = read("lib/network/discovery/latest-run.ts")
  const picker = source.slice(
    source.indexOf("export function pickLatestCompletedDiscoveryJob("),
    source.indexOf("export function pickLatestCompletedDiscoveryJobForHost")
  )
  assert.doesNotMatch(picker, /Date\.parse/)
})

test("dos Discovery con el mismo timestamp desempatan por id y no mezclan hosts", () => {
  const same = "2026-11-26T18:00:00.500000Z"
  const host = "10.7.1.1"
  const otherHost = "10.7.1.9"
  const jobs = [
    completedDiscovery({ id: jobId(2), host, completedAt: same }),
    completedDiscovery({
      id: jobId(8),
      host: otherHost,
      completedAt: "2026-11-26T18:00:00.500000+00:00",
    }),
    completedDiscovery({ id: jobId(4), host, completedAt: same }),
  ]

  assert.equal(pickLatestCompletedDiscoveryJobForHost(jobs, host)?.id, jobId(4))
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost([...jobs].reverse(), host)?.id,
    jobId(4)
  )
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(jobs, otherHost)?.id,
    jobId(8)
  )
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(jobs, otherHost)?.targetHost,
    otherHost
  )
})

test("el listado del Agent aísla por empresa y excluye eliminados", async () => {
  const otherCompany = "00000000-0000-4000-8000-000000000099"
  const otherAgent = "00000000-0000-4000-8000-0000000000bb"
  function agentRow({ id, companyId, agentId, createdAt, deletedAt = null }) {
    return {
      id,
      company_id: companyId,
      agent_id: agentId,
      site_id: null,
      job_type: "monitoring",
      status: "completed",
      error_message: null,
      dispatched_at: null,
      started_at: createdAt,
      completed_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: deletedAt,
      payload: { secret: "no-mostrar" },
      result: { status: "online" },
    }
  }
  const rows = [
    agentRow({
      id: jobId(1),
      companyId: COMPANY,
      agentId: AGENT,
      createdAt: stamp(1),
    }),
    agentRow({
      id: jobId(2),
      companyId: otherCompany,
      agentId: AGENT,
      createdAt: stamp(50),
    }),
    agentRow({
      id: jobId(3),
      companyId: COMPANY,
      agentId: AGENT,
      createdAt: stamp(80),
      deletedAt: stamp(81),
    }),
    agentRow({
      id: jobId(4),
      companyId: COMPANY,
      agentId: otherAgent,
      createdAt: stamp(40),
    }),
  ]
  const client = createJobClient(rows)
  const jobs = await listNetworkAgentJobs(client, COMPANY, AGENT)
  const call = client.calls[0]

  assert.deepEqual(
    jobs.map((job) => job.id),
    [jobId(1)]
  )
  assert.equal(
    call.filters.some(
      (filter) =>
        filter.op === "eq" &&
        filter.column === "company_id" &&
        filter.value === COMPANY
    ),
    true
  )
  assert.equal(
    call.filters.some(
      (filter) =>
        filter.op === "eq" && filter.column === "agent_id" && filter.value === AGENT
    ),
    true
  )
  assert.equal(
    call.filters.some(
      (filter) =>
        filter.op === "is" && filter.column === "deleted_at" && filter.value === null
    ),
    true
  )

  const route = read("app/api/network/agents/[agentId]/jobs/route.ts")
  assert.match(route, /getNetworkAgent\(client, auth\.companyId, agentId\)/)
  assert.match(route, /listNetworkAgentJobs\(client, auth\.companyId, agentId\)/)
})

test("el SQL de índices sigue preparado y sin ejecutar", () => {
  const sql = read("scripts/network-retention-indexes.sql")
  assert.match(sql, /CREATE INDEX CONCURRENTLY network_agent_jobs_retention_idx/)
  assert.match(
    sql,
    /job_type,\s*status,\s*\(COALESCE\(completed_at, created_at\)\),\s*id/
  )
  assert.match(sql, /CREATE INDEX CONCURRENTLY network_agent_jobs_company_type_created_idx/)
  assert.match(sql, /CREATE INDEX CONCURRENTLY network_agent_jobs_pending_claim_idx/)
  assert.match(sql, /CREATE INDEX CONCURRENTLY network_device_status_events_job_idx/)
  assert.match(sql, /indice\.indisvalid/)
  assert.doesNotMatch(sql, /^\s*BEGIN\b/m)
})

function sameDeleted() {
  return "2026-11-26T19:00:00.000000+00:00"
}
