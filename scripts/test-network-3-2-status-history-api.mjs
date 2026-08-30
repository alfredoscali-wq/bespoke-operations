import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  attachHistoryEventDurations,
  durationSecondsUntilNextEvent,
  listNetworkDeviceStatusHistory,
} from "../lib/network/monitoring/status-history.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "co-1"
const OTHER_COMPANY = "co-2"
const AGENT = "ag-1"
const DEVICE = "dev-1"
const NEIGHBOR = "dev-neighbor"

function matches(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col]
    if (filter.op === "is") return value === filter.val
    return value === filter.val
  })
}

function createReadClient(seed = {}) {
  const db = {
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
    network_device_status_events: [...(seed.events ?? [])],
  }

  function from(table) {
    const state = {
      filters: [],
      order: null,
    }

    const chain = {
      select() {
        return chain
      },
      eq(col, val) {
        state.filters.push({ col, op: "eq", val })
        return chain
      },
      is(col, val) {
        state.filters.push({ col, op: "is", val })
        return chain
      },
      order(col, opts) {
        state.order = { col, ascending: Boolean(opts?.ascending) }
        return chain
      },
      maybeSingle() {
        return execute("single")
      },
      then(resolve, reject) {
        return execute("many").then(resolve, reject)
      },
    }

    async function execute(mode) {
      let rows = (db[table] ?? []).filter((row) => matches(row, state.filters))
      if (state.order) {
        rows = [...rows].sort((left, right) => {
          const leftVal = left[state.order.col]
          const rightVal = right[state.order.col]
          if (leftVal === rightVal) return 0
          const compared = leftVal < rightVal ? -1 : 1
          return state.order.ascending ? compared : -compared
        })
      }
      if (mode === "single") {
        return { data: rows[0] ?? null, error: null }
      }
      return { data: rows, error: null }
    }

    return chain
  }

  return { from, db }
}

function eventRow(input) {
  return {
    id: input.id,
    company_id: input.companyId ?? COMPANY,
    device_id: input.deviceId ?? DEVICE,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    changed_at: input.changedAt,
    job_id: input.jobId ?? null,
    consecutive_failures: input.consecutiveFailures ?? null,
    message: input.message ?? null,
    deleted_at: input.deletedAt ?? null,
  }
}

const t0 = "2026-08-30T10:00:00.000Z"
const t1 = "2026-08-30T10:05:00.000Z"
const t2 = "2026-08-30T10:20:00.000Z"

const managedEvents = [
  eventRow({
    id: "ev-offline",
    previousStatus: "online",
    newStatus: "offline",
    changedAt: t1,
    jobId: "job-fail",
    consecutiveFailures: 3,
    message: "router down",
  }),
  eventRow({
    id: "ev-online",
    previousStatus: "unknown",
    newStatus: "online",
    changedAt: t0,
    jobId: "job-ok",
    consecutiveFailures: 0,
    message: null,
  }),
  eventRow({
    id: "ev-recover",
    previousStatus: "offline",
    newStatus: "online",
    changedAt: t2,
    jobId: "job-recover",
    consecutiveFailures: 0,
    message: null,
  }),
]

test("duración: evento más reciente es null; el resto usa el changed_at siguiente", () => {
  assert.equal(durationSecondsUntilNextEvent(t2, null), null)
  assert.equal(durationSecondsUntilNextEvent(t1, t2), 15 * 60)
  assert.equal(durationSecondsUntilNextEvent(t0, t1), 5 * 60)

  const attached = attachHistoryEventDurations([
    {
      id: "newest",
      previousStatus: "offline",
      newStatus: "online",
      changedAt: t2,
      jobId: null,
      consecutiveFailures: 0,
      message: null,
    },
    {
      id: "mid",
      previousStatus: "online",
      newStatus: "offline",
      changedAt: t1,
      jobId: null,
      consecutiveFailures: 3,
      message: null,
    },
    {
      id: "oldest",
      previousStatus: "unknown",
      newStatus: "online",
      changedAt: t0,
      jobId: null,
      consecutiveFailures: 0,
      message: null,
    },
  ])
  assert.equal(attached[0].durationSeconds, null)
  assert.equal(attached[1].durationSeconds, 900)
  assert.equal(attached[2].durationSeconds, 300)
})

test("un solo evento tiene durationSeconds null", () => {
  const attached = attachHistoryEventDurations([
    {
      id: "only",
      previousStatus: "unknown",
      newStatus: "online",
      changedAt: t0,
      jobId: "job-1",
      consecutiveFailures: 0,
      message: null,
    },
  ])
  assert.equal(attached.length, 1)
  assert.equal(attached[0].durationSeconds, null)
})

test("dispositivo administrado: eventos DESC con duración, job y message", async () => {
  const client = createReadClient({ events: managedEvents })
  const history = await listNetworkDeviceStatusHistory(client, COMPANY, DEVICE)
  assert.ok(history)
  assert.deepEqual(
    history.events.map((event) => event.id),
    ["ev-recover", "ev-offline", "ev-online"]
  )
  assert.equal(history.events[0].previousStatus, "offline")
  assert.equal(history.events[0].newStatus, "online")
  assert.equal(history.events[0].durationSeconds, null)
  assert.equal(history.events[0].jobId, "job-recover")
  assert.equal(history.events[1].durationSeconds, 900)
  assert.equal(history.events[1].consecutiveFailures, 3)
  assert.equal(history.events[1].message, "router down")
  assert.equal(history.events[2].durationSeconds, 300)
  assert.equal(history.events[2].changedAt, t0)
})

test("managed sin eventos devuelve lista vacía", async () => {
  const client = createReadClient({ events: [] })
  const history = await listNetworkDeviceStatusHistory(client, COMPANY, DEVICE)
  assert.deepEqual(history, { events: [] })
})

test("vecino no administrado no devuelve histórico aunque haya filas", async () => {
  const client = createReadClient({
    events: [
      eventRow({
        id: "ev-neighbor",
        deviceId: NEIGHBOR,
        previousStatus: "unknown",
        newStatus: "online",
        changedAt: t0,
      }),
    ],
  })
  const history = await listNetworkDeviceStatusHistory(client, COMPANY, NEIGHBOR)
  assert.deepEqual(history, { events: [] })
})

test("otro tenant no ve el device ni sus eventos", async () => {
  const client = createReadClient({
    events: [
      eventRow({
        id: "ev-other",
        companyId: OTHER_COMPANY,
        previousStatus: "unknown",
        newStatus: "online",
        changedAt: t0,
      }),
    ],
  })
  const history = await listNetworkDeviceStatusHistory(
    client,
    OTHER_COMPANY,
    DEVICE
  )
  assert.equal(history, null)
})

test("eventos soft-deleted no se devuelven", async () => {
  const client = createReadClient({
    events: [
      eventRow({
        id: "ev-live",
        previousStatus: "unknown",
        newStatus: "online",
        changedAt: t1,
      }),
      eventRow({
        id: "ev-gone",
        previousStatus: "online",
        newStatus: "offline",
        changedAt: t2,
        deletedAt: t2,
      }),
    ],
  })
  const history = await listNetworkDeviceStatusHistory(client, COMPANY, DEVICE)
  assert.deepEqual(
    history.events.map((event) => event.id),
    ["ev-live"]
  )
  assert.equal(history.events[0].durationSeconds, null)
})

test("duración no usa freshness 2.6 ni Date.now como sucesor", () => {
  const history = read("lib/network/monitoring/status-history.ts")
  assert.doesNotMatch(history, /displayMonitoringStatus/)
  assert.doesNotMatch(history, /NETWORK_MONITORING_STATUS_TTL_MS/)
  assert.doesNotMatch(history, /Date\.now/)
  assert.match(history, /isManagedNetworkDevice/)
  assert.doesNotMatch(history, /origin/)
})

test("API GET /history reutiliza auth Network y no toca persistencia", () => {
  const route = read("app/api/network/devices/[deviceId]/history/route.ts")
  assert.match(route, /export async function GET/)
  assert.match(route, /requireNetworkReadContext/)
  assert.match(route, /listNetworkDeviceStatusHistory/)
  assert.match(route, /events: history\.events/)
  assert.doesNotMatch(route, /persistMonitoringSnapshot/)

  const persist = read("lib/network/monitoring/persist-snapshot.ts")
  assert.doesNotMatch(persist, /listNetworkDeviceStatusHistory/)
  assert.doesNotMatch(persist, /durationSeconds/)
  assert.doesNotMatch(persist, /status-history/)

  const types = read("lib/network/types.ts")
  assert.match(types, /export type NetworkDeviceStatusHistoryEvent/)
  assert.match(types, /durationSeconds: number \| null/)

  const agent = read("lib/network/jobs/agent-execution.ts")
  assert.doesNotMatch(agent, /listNetworkDeviceStatusHistory/)
  const topology = read("lib/network/topology/queries.ts")
  assert.doesNotMatch(topology, /listNetworkDeviceStatusHistory/)
  const discovery = read("lib/network/devices/queries.ts")
  assert.doesNotMatch(
    discovery.slice(discovery.indexOf("export async function persistDiscoverySnapshot")),
    /listNetworkDeviceStatusHistory/
  )
})
