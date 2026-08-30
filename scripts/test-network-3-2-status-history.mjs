import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { persistMonitoringSnapshot } from "../lib/network/monitoring/persist-snapshot.ts"
import { displayMonitoringStatus } from "../lib/network/monitoring/status.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "co-1"
const AGENT = "ag-1"
const DEVICE = "dev-1"
const NEIGHBOR = "dev-neighbor"
const JOB = "job-1"

function snapshot() {
  return {
    vendor: "mikrotik",
    deviceId: DEVICE,
    targetId: "tgt-1",
    host: "192.168.56.2",
    hostname: "CORE-LAB",
    routerosVersion: "7.16",
    uptime: "1d",
    cpuLoad: 1,
    memoryTotal: 1000,
    memoryAvailable: 500,
    temperature: null,
    interfaces: [],
    warnings: [],
  }
}

function matches(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col]
    if (filter.op === "is") return value === filter.val
    return value === filter.val
  })
}

function createMemoryClient(seed = {}) {
  const db = {
    network_device_status: [...(seed.status ?? [])],
    network_device_status_events: [...(seed.events ?? [])],
    network_devices: seed.devices ?? [
      {
        id: DEVICE,
        company_id: COMPANY,
        agent_id: AGENT,
        management_ip: "192.168.56.2",
        deleted_at: null,
      },
      {
        id: NEIGHBOR,
        company_id: COMPANY,
        agent_id: AGENT,
        management_ip: "10.10.1.1",
        deleted_at: null,
      },
    ],
    network_discovery_targets: seed.targets ?? [
      {
        company_id: COMPANY,
        agent_id: AGENT,
        host: "192.168.56.2",
        deleted_at: null,
      },
    ],
    network_interfaces: [],
    network_interface_status: [],
  }
  let seq = 1

  function from(table) {
    const state = {
      table,
      type: "select",
      patch: null,
      row: null,
      filters: [],
    }

    const chain = {
      select() {
        if (state.type !== "update" && state.type !== "insert") state.type = "select"
        return chain
      },
      eq(col, val) {
        state.filters.push({ op: "eq", col, val })
        return chain
      },
      is(col, val) {
        state.filters.push({ op: "is", col, val })
        return chain
      },
      update(patch) {
        state.type = "update"
        state.patch = patch
        state.filters = []
        return chain
      },
      insert(row) {
        state.type = "insert"
        state.row = row
        return chain
      },
      maybeSingle() {
        return execute("maybeSingle")
      },
      then(resolve, reject) {
        return execute("many").then(resolve, reject)
      },
    }

    async function execute(mode) {
      const rows = db[table] ?? []
      if (state.type === "select") {
        const found = rows.filter((row) => matches(row, state.filters))
        if (mode === "maybeSingle") {
          return { data: found[0] ?? null, error: null }
        }
        return { data: found, error: null }
      }
      if (state.type === "update") {
        const matched = rows.filter((row) => matches(row, state.filters))
        for (const row of matched) Object.assign(row, state.patch)
        return { data: matched.map((row) => ({ id: row.id })), error: null }
      }
      if (state.type === "insert") {
        if (table === "network_device_status") {
          const exists = rows.some(
            (row) =>
              row.device_id === state.row.device_id && row.deleted_at == null
          )
          if (exists) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate key value" },
            }
          }
        }
        const inserted = { id: `row-${seq++}`, deleted_at: null, ...state.row }
        rows.push(inserted)
        if (mode === "maybeSingle") return { data: inserted, error: null }
        return { data: [inserted], error: null }
      }
      return { data: null, error: null }
    }

    return chain
  }

  return {
    from,
    db,
  }
}

async function persist(client, input) {
  return persistMonitoringSnapshot(client, {
    companyId: COMPANY,
    deviceId: DEVICE,
    snapshot: input.success ? snapshot() : null,
    jobId: JOB,
    ...input,
  })
}

test("1: primer éxito unknown → online crea 1 evento", async () => {
  const client = createMemoryClient()
  const result = await persist(client, { success: true })
  assert.equal(result.previousStatus, "unknown")
  assert.equal(result.status, "online")
  assert.equal(client.db.network_device_status.length, 1)
  assert.equal(client.db.network_device_status_events.length, 1)
  const event = client.db.network_device_status_events[0]
  assert.equal(event.previous_status, "unknown")
  assert.equal(event.new_status, "online")
})

test("2: segundo éxito no crea evento", async () => {
  const client = createMemoryClient()
  await persist(client, { success: true })
  const result = await persist(client, { success: true })
  assert.equal(result.previousStatus, "online")
  assert.equal(result.status, "online")
  assert.equal(client.db.network_device_status_events.length, 1)
})

test("3-4: fallos 1 y 2 no crean eventos", async () => {
  const client = createMemoryClient()
  await persist(client, { success: true })
  const fail1 = await persist(client, { success: false, errorMessage: "fail-1" })
  assert.equal(fail1.status, "online")
  assert.equal(fail1.consecutiveFailures, 1)
  const fail2 = await persist(client, { success: false, errorMessage: "fail-2" })
  assert.equal(fail2.status, "online")
  assert.equal(fail2.consecutiveFailures, 2)
  assert.equal(client.db.network_device_status_events.length, 1)
})

test("5-6: fallo 3 online → offline crea 1 evento; fallos posteriores no", async () => {
  const client = createMemoryClient()
  await persist(client, { success: true })
  await persist(client, { success: false, errorMessage: "fail-1" })
  await persist(client, { success: false, errorMessage: "fail-2" })
  const fail3 = await persist(client, { success: false, errorMessage: "fail-3" })
  assert.equal(fail3.previousStatus, "online")
  assert.equal(fail3.status, "offline")
  assert.equal(fail3.consecutiveFailures, 3)
  assert.equal(client.db.network_device_status_events.length, 2)
  const offline = client.db.network_device_status_events[1]
  assert.equal(offline.previous_status, "online")
  assert.equal(offline.new_status, "offline")
  assert.equal(offline.consecutive_failures, 3)
  assert.equal(offline.message, "fail-3")
  assert.equal(offline.job_id, JOB)
  await persist(client, { success: false, errorMessage: "fail-4" })
  assert.equal(client.db.network_device_status_events.length, 2)
})

test("7: éxito después de offline → online crea 1 evento", async () => {
  const client = createMemoryClient()
  await persist(client, { success: true })
  await persist(client, { success: false })
  await persist(client, { success: false })
  await persist(client, { success: false })
  const recovered = await persist(client, { success: true })
  assert.equal(recovered.previousStatus, "offline")
  assert.equal(recovered.status, "online")
  assert.equal(client.db.network_device_status_events.length, 3)
  const last = client.db.network_device_status_events.at(-1)
  assert.equal(last.previous_status, "offline")
  assert.equal(last.new_status, "online")
})

test("8: freshness 2.6 no crea eventos", () => {
  const persistSource = read("lib/network/monitoring/persist-snapshot.ts")
  assert.doesNotMatch(persistSource, /displayMonitoringStatus/)
  assert.doesNotMatch(persistSource, /NETWORK_MONITORING_STATUS_TTL_MS/)
  const now = Date.parse("2026-08-30T16:00:00.000Z")
  const stale = new Date(now - 301_000).toISOString()
  assert.equal(displayMonitoringStatus("online", stale, now), "unknown")
})

test("9: vecino no administrado no crea eventos", async () => {
  const client = createMemoryClient()
  const result = await persistMonitoringSnapshot(client, {
    companyId: COMPANY,
    deviceId: NEIGHBOR,
    snapshot: { ...snapshot(), deviceId: NEIGHBOR, host: "10.10.1.1" },
    success: true,
    jobId: JOB,
  })
  assert.equal(result.status, "online")
  assert.equal(client.db.network_device_status.length, 1)
  assert.equal(client.db.network_device_status_events.length, 0)
})

test("10-13: changed_at, job_id, consecutive_failures y message se conservan", async () => {
  const client = createMemoryClient()
  await persist(client, { success: true })
  const status = client.db.network_device_status[0]
  const event = client.db.network_device_status_events[0]
  assert.equal(event.changed_at, status.last_poll_at)
  assert.equal(event.job_id, JOB)
  assert.equal(event.consecutive_failures, 0)
  assert.equal(event.message, null)
  await persist(client, { success: false, errorMessage: "fail-1" })
  await persist(client, { success: false, errorMessage: "fail-2" })
  await persist(client, { success: false, errorMessage: "router down" })
  const offline = client.db.network_device_status_events[1]
  const offlineStatus = client.db.network_device_status[0]
  assert.equal(offline.changed_at, offlineStatus.last_poll_at)
  assert.equal(offline.job_id, JOB)
  assert.equal(offline.consecutive_failures, 3)
  assert.equal(offline.message, "router down")
})

test("14: dos persistencias concurrentes del mismo cambio no crean dos eventos", async () => {
  const client = createMemoryClient()
  await persist(client, { success: true })
  await persist(client, { success: false })
  await persist(client, { success: false })
  const before = client.db.network_device_status_events.length
  const [left, right] = await Promise.all([
    persist(client, { success: false, errorMessage: "fail-3a" }),
    persist(client, { success: false, errorMessage: "fail-3b" }),
  ])
  assert.equal(client.db.network_device_status_events.length, before + 1)
  assert.equal(client.db.network_device_status[0].status, "offline")
  const statuses = [left.status, right.status].sort()
  assert.deepEqual(statuses, ["offline", "offline"])
})

test("15: dos primeros polls concurrentes no crean dos filas ni dos eventos", async () => {
  const client = createMemoryClient()
  await Promise.all([
    persist(client, { success: true }),
    persist(client, { success: true }),
  ])
  assert.equal(client.db.network_device_status.length, 1)
  assert.equal(client.db.network_device_status_events.length, 1)
  assert.equal(client.db.network_device_status_events[0].previous_status, "unknown")
  assert.equal(client.db.network_device_status_events[0].new_status, "online")
})

test("unknown → unknown no crea evento; jobId se pasa desde /result", async () => {
  const client = createMemoryClient()
  const firstFail = await persist(client, { success: false, errorMessage: "down" })
  assert.equal(firstFail.previousStatus, "unknown")
  assert.equal(firstFail.status, "unknown")
  assert.equal(client.db.network_device_status_events.length, 0)
  const execution = read("lib/network/jobs/agent-execution.ts")
  assert.match(execution, /jobId: input\.jobId/)
  assert.match(read("lib/network/monitoring/queries.ts"), /export \{ persistMonitoringSnapshot \}/)
  assert.match(
    read("lib/network/monitoring/persist-snapshot.ts"),
    /\.eq\("status", previousStatus\)/
  )
  assert.match(
    read("lib/network/monitoring/persist-snapshot.ts"),
    /isManagedNetworkDevice/
  )
  assert.doesNotMatch(read("lib/network/monitoring/persist-snapshot.ts"), /origin/)
})
