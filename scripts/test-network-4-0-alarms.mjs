import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  acknowledgeNetworkAlarm,
  markNetworkAlarmSeen,
  resolveNetworkAlarm,
} from "../lib/network/alarms/queries.ts"
import { classifyNetworkAlarmRole, severityForNetworkAlarmRole } from "../lib/network/alarms/role.ts"
import { networkAlarmMttaMs, networkAlarmMttrMs } from "../lib/network/alarms/metrics.ts"
import { MONITORING_DECRYPT_ERROR_CODE } from "../lib/network/monitoring/contract.ts"
import {
  isMonitoringDeviceDue,
  pickDueMonitoringDevice,
} from "../lib/network/monitoring/due.ts"
import { persistMonitoringSnapshot } from "../lib/network/monitoring/persist-snapshot.ts"
import { nextMonitoringOperationalState } from "../lib/network/monitoring/status.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "co-1"
const AGENT = "ag-1"
const CORE = "dev-core"
const POWERBOX = "dev-agg"
const AS5 = "dev-ap-5"
const AS6 = "dev-ap-6"
const AS7 = "dev-ap-7"
const CPE = "dev-cpe"
const JOB = "job-1"
const ACTOR = { employeeId: "emp-1", authUserId: "auth-1" }

function matches(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col]
    if (filter.op === "is") return value === filter.val
    if (filter.op === "neq") return value !== filter.val
    if (filter.op === "in") return filter.val.includes(value)
    return value === filter.val
  })
}

function device(id, type, ip) {
  return {
    id,
    company_id: COMPANY,
    agent_id: AGENT,
    management_ip: ip,
    device_type: type,
    hostname: id,
    deleted_at: null,
  }
}

function target(host) {
  return {
    id: `tgt-${host}`,
    company_id: COMPANY,
    agent_id: AGENT,
    host,
    deleted_at: null,
  }
}

function snapshot(deviceId, host) {
  return {
    vendor: "mikrotik",
    deviceId,
    targetId: `tgt-${host}`,
    host,
    hostname: deviceId,
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

function createMemoryClient() {
  const db = {
    network_devices: [
      device(CORE, "router", "10.0.0.1"),
      device(POWERBOX, "switch", "10.0.0.2"),
      device(AS5, "radio", "10.0.0.5"),
      device(AS6, "radio", "10.0.0.6"),
      device(AS7, "radio", "10.0.0.7"),
      device(CPE, "cpe", "10.0.0.32"),
    ],
    network_discovery_targets: [
      target("10.0.0.1"),
      target("10.0.0.2"),
      target("10.0.0.5"),
      target("10.0.0.6"),
      target("10.0.0.7"),
    ],
    network_device_status: [],
    network_device_status_events: [],
    network_alarms: [],
    network_interfaces: [],
    network_interface_status: [],
    network_agent_jobs: [],
  }
  let seq = 1

  function from(table) {
    if (!db[table]) db[table] = []
    const state = {
      table,
      type: "select",
      patch: null,
      row: null,
      filters: [],
    }

    const chain = {
      select() {
        return chain
      },
      eq(col, val) {
        state.filters.push({ op: "eq", col, val })
        return chain
      },
      neq(col, val) {
        state.filters.push({ op: "neq", col, val })
        return chain
      },
      is(col, val) {
        state.filters.push({ op: "is", col, val })
        return chain
      },
      in(col, val) {
        state.filters.push({ op: "in", col, val })
        return chain
      },
      order() {
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
      const rows = db[table]
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
        if (mode === "maybeSingle") {
          return { data: matched[0] ?? null, error: null }
        }
        return { data: matched.map((row) => ({ id: row.id })), error: null }
      }
      if (state.type === "insert") {
        const rowsRef = db[table]
        if (table === "network_device_status") {
          const exists = rowsRef.some(
            (row) => row.device_id === state.row.device_id && row.deleted_at == null
          )
          if (exists) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate key value" },
            }
          }
        }
        if (table === "network_alarms") {
          const status = state.row.status
          if (status === "open" || status === "acknowledged") {
            const exists = rowsRef.some(
              (row) =>
                row.device_id === state.row.device_id &&
                row.deleted_at == null &&
                (row.status === "open" || row.status === "acknowledged")
            )
            if (exists) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key value" },
              }
            }
          }
        }
        const inserted = { id: `row-${seq++}`, deleted_at: null, ...state.row }
        rowsRef.push(inserted)
        if (mode === "maybeSingle") return { data: inserted, error: null }
        return { data: [inserted], error: null }
      }
      return { data: null, error: null }
    }

    return chain
  }

  return { from, db }
}

function hostFor(deviceId) {
  if (deviceId === CORE) return "10.0.0.1"
  if (deviceId === POWERBOX) return "10.0.0.2"
  if (deviceId === AS5) return "10.0.0.5"
  if (deviceId === AS6) return "10.0.0.6"
  if (deviceId === AS7) return "10.0.0.7"
  return "10.0.0.32"
}

async function persistDevice(client, deviceId, input) {
  return persistMonitoringSnapshot(client, {
    companyId: COMPANY,
    deviceId,
    snapshot: input.success ? snapshot(deviceId, hostFor(deviceId)) : null,
    jobId: JOB,
    ...input,
  })
}

async function bringOnline(client, deviceId) {
  return persistDevice(client, deviceId, { success: true })
}

async function bringOffline(client, deviceId) {
  await bringOnline(client, deviceId)
  await persistDevice(client, deviceId, { success: false, errorMessage: "fail-1" })
  await persistDevice(client, deviceId, { success: false, errorMessage: "fail-2" })
  return persistDevice(client, deviceId, { success: false, errorMessage: "fail-3" })
}

function activeAlarms(client, deviceId) {
  return client.db.network_alarms.filter(
    (row) =>
      row.deleted_at == null &&
      (row.status === "open" || row.status === "acknowledged") &&
      (deviceId ? row.device_id === deviceId : true)
  )
}

test("1: online → offline después de 3 fallos crea una alarma", async () => {
  const client = createMemoryClient()
  const result = await bringOffline(client, CORE)
  assert.equal(result.previousStatus, "online")
  assert.equal(result.status, "offline")
  assert.equal(activeAlarms(client, CORE).length, 1)
  assert.equal(activeAlarms(client, CORE)[0].root_alarm_id, null)
  assert.equal(activeAlarms(client, CORE)[0].severity, "critical")
})

test("2: un solo fallo no crea alarma", async () => {
  const client = createMemoryClient()
  await bringOnline(client, CORE)
  const fail1 = await persistDevice(client, CORE, { success: false, errorMessage: "fail-1" })
  assert.equal(fail1.status, "online")
  assert.equal(fail1.consecutiveFailures, 1)
  assert.equal(activeAlarms(client).length, 0)
})

test("3: dos fallos no crean alarma", async () => {
  const client = createMemoryClient()
  await bringOnline(client, CORE)
  await persistDevice(client, CORE, { success: false, errorMessage: "fail-1" })
  const fail2 = await persistDevice(client, CORE, { success: false, errorMessage: "fail-2" })
  assert.equal(fail2.status, "online")
  assert.equal(fail2.consecutiveFailures, 2)
  assert.equal(activeAlarms(client).length, 0)
})

test("4: tres fallos crean una sola alarma", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  assert.equal(activeAlarms(client, CORE).length, 1)
})

test("5: cuarto/quinto/sexto poll fallido no crea nuevas alarmas", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  await persistDevice(client, CORE, { success: false, errorMessage: "fail-4" })
  await persistDevice(client, CORE, { success: false, errorMessage: "fail-5" })
  await persistDevice(client, CORE, { success: false, errorMessage: "fail-6" })
  assert.equal(client.db.network_alarms.length, 1)
  assert.equal(activeAlarms(client, CORE).length, 1)
})

test("6: offline → online resuelve la alarma existente", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  const recovered = await persistDevice(client, CORE, { success: true })
  assert.equal(recovered.previousStatus, "offline")
  assert.equal(recovered.status, "online")
  assert.equal(activeAlarms(client).length, 0)
  assert.equal(client.db.network_alarms[0].status, "resolved")
  assert.ok(client.db.network_alarms[0].resolved_at)
  assert.equal(client.db.network_alarms[0].resolved_by, null)
})

test("7: offline → online → offline crea una nueva alarma", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  await persistDevice(client, CORE, { success: true })
  await bringOffline(client, CORE)
  assert.equal(client.db.network_alarms.length, 2)
  assert.equal(client.db.network_alarms[0].status, "resolved")
  assert.equal(client.db.network_alarms[1].status, "open")
  assert.notEqual(client.db.network_alarms[0].id, client.db.network_alarms[1].id)
})

test("8: Core → critical; router → aggregation / critical", () => {
  const core = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "core",
    managedAncestorCount: 0,
  })
  assert.equal(core, "core")
  assert.equal(severityForNetworkAlarmRole(core), "critical")

  const router = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "router",
    managedAncestorCount: 0,
  })
  assert.equal(router, "aggregation")
  assert.equal(severityForNetworkAlarmRole(router), "critical")

  const routerWithLegacyAncestry = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "router",
    managedAncestorCount: 2,
  })
  assert.equal(routerWithLegacyAncestry, "aggregation")
})

test("9: switch / olt / router → aggregation / critical", () => {
  const switchRole = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "switch",
    managedAncestorCount: 1,
  })
  const oltRole = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "olt",
    managedAncestorCount: 0,
  })
  const routerRole = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "router",
    managedAncestorCount: 1,
  })
  assert.equal(switchRole, "aggregation")
  assert.equal(oltRole, "aggregation")
  assert.equal(routerRole, "aggregation")
  assert.equal(severityForNetworkAlarmRole(switchRole), "critical")
  assert.equal(severityForNetworkAlarmRole(oltRole), "critical")
})

test("10: AP/radio → warning; router no es AP", () => {
  const radio = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "radio",
    managedAncestorCount: 2,
  })
  const ap = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "ap",
    managedAncestorCount: 0,
  })
  const router = classifyNetworkAlarmRole({
    isManaged: true,
    deviceType: "router",
    managedAncestorCount: 2,
  })
  assert.equal(radio, "ap")
  assert.equal(ap, "ap")
  assert.equal(severityForNetworkAlarmRole(radio), "warning")
  assert.equal(severityForNetworkAlarmRole(ap), "warning")
  assert.equal(router, "aggregation")
  assert.equal(severityForNetworkAlarmRole(router), "critical")
})

test("11: CPE → no alarma", async () => {
  assert.equal(
    classifyNetworkAlarmRole({
      isManaged: false,
      deviceType: "cpe",
      managedAncestorCount: 0,
    }),
    "cpe"
  )
  assert.equal(
    classifyNetworkAlarmRole({
      isManaged: true,
      deviceType: "onu",
      managedAncestorCount: 0,
    }),
    "cpe"
  )
  assert.equal(
    classifyNetworkAlarmRole({
      isManaged: false,
      deviceType: "router",
      managedAncestorCount: 0,
    }),
    "cpe"
  )
  assert.equal(severityForNetworkAlarmRole("cpe"), null)

  const client = createMemoryClient()
  await bringOffline(client, CPE)
  assert.equal(activeAlarms(client, CPE).length, 0)
  assert.equal(client.db.network_alarms.length, 0)
})

test("12: Core y PowerBox offline abren alarmas independientes", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  await bringOffline(client, POWERBOX)
  const coreAlarm = activeAlarms(client, CORE)[0]
  const pbAlarm = activeAlarms(client, POWERBOX)[0]
  assert.ok(coreAlarm)
  assert.ok(pbAlarm)
  assert.equal(coreAlarm.root_alarm_id, null)
  assert.equal(pbAlarm.root_alarm_id, null)
  assert.notEqual(coreAlarm.id, pbAlarm.id)
  assert.equal(activeAlarms(client).length, 2)
})

test("13: Core y APs offline generan una alarma independiente por dispositivo", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  await bringOffline(client, AS5)
  await bringOffline(client, AS6)
  await bringOffline(client, AS7)
  assert.equal(activeAlarms(client).length, 4)
  assert.equal(activeAlarms(client, CORE)[0].severity, "critical")
  for (const ap of [AS5, AS6, AS7]) {
    const alarm = activeAlarms(client, ap)[0]
    assert.ok(alarm)
    assert.equal(alarm.root_alarm_id, null)
    assert.equal(alarm.severity, "warning")
  }
})

test("14: Core online + AS5 offline → AS5 crea alarma propia warning", async () => {
  const client = createMemoryClient()
  await bringOnline(client, CORE)
  await bringOnline(client, POWERBOX)
  await bringOffline(client, AS5)
  const alarm = activeAlarms(client, AS5)[0]
  assert.ok(alarm)
  assert.equal(alarm.is_root, true)
  assert.equal(alarm.root_alarm_id, null)
  assert.equal(alarm.severity, "warning")
  assert.equal(activeAlarms(client, CORE).length, 0)
})

test("15: recuperar un dispositivo no resuelve la alarma de otro", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  await bringOffline(client, POWERBOX)
  const pbAlarmId = activeAlarms(client, POWERBOX)[0].id
  const recovered = await persistDevice(client, CORE, { success: true })
  assert.equal(recovered.status, "online")
  assert.equal(activeAlarms(client, CORE).length, 0)
  const pbAlarm = activeAlarms(client, POWERBOX)[0]
  assert.ok(pbAlarm)
  assert.equal(pbAlarm.id, pbAlarmId)
  assert.equal(pbAlarm.status, "open")
  assert.equal(pbAlarm.root_alarm_id, null)
})

test("unknown → offline no genera alarma", async () => {
  const client = createMemoryClient()
  await persistDevice(client, CORE, { success: false, errorMessage: "fail-1" })
  await persistDevice(client, CORE, { success: false, errorMessage: "fail-2" })
  const result = await persistDevice(client, CORE, { success: false, errorMessage: "fail-3" })
  assert.equal(result.previousStatus, "unknown")
  assert.equal(result.status, "offline")
  assert.equal(activeAlarms(client).length, 0)
})

test("16: ACK guarda acknowledged_at y acknowledged_by", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  const alarmId = activeAlarms(client, CORE)[0].id
  const result = await acknowledgeNetworkAlarm(client, {
    companyId: COMPANY,
    alarmId,
    actor: ACTOR,
    acknowledgedAt: "2026-12-03T10:05:00.000Z",
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.alarm.status, "acknowledged")
    assert.equal(result.alarm.acknowledgedAt, "2026-12-03T10:05:00.000Z")
    assert.equal(result.alarm.acknowledgedBy, "emp-1")
  }
})

test("17: SEEN guarda seen_at", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  const alarmId = activeAlarms(client, CORE)[0].id
  const alarm = await markNetworkAlarmSeen(client, {
    companyId: COMPANY,
    alarmId,
    seenAt: "2026-12-03T10:01:00.000Z",
  })
  assert.ok(alarm)
  assert.equal(alarm.seenAt, "2026-12-03T10:01:00.000Z")
  const again = await markNetworkAlarmSeen(client, {
    companyId: COMPANY,
    alarmId,
    seenAt: "2026-12-03T10:09:00.000Z",
  })
  assert.equal(again.seenAt, "2026-12-03T10:01:00.000Z")
})

test("18: RESOLVE guarda resolved_at, resolved_by y resolution_note", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  const alarmId = activeAlarms(client, CORE)[0].id
  const result = await resolveNetworkAlarm(client, {
    companyId: COMPANY,
    alarmId,
    actor: ACTOR,
    resolutionNote: "Enlace restaurado.",
    resolvedAt: "2026-12-03T10:20:00.000Z",
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.alarm.status, "resolved")
    assert.equal(result.alarm.resolvedAt, "2026-12-03T10:20:00.000Z")
    assert.equal(result.alarm.resolvedBy, "emp-1")
    assert.equal(result.alarm.resolutionNote, "Enlace restaurado.")
  }
})

test("19: MTTA = acknowledged_at - created_at", () => {
  assert.equal(
    networkAlarmMttaMs({
      createdAt: "2026-12-03T10:00:00.000Z",
      acknowledgedAt: "2026-12-03T10:05:00.000Z",
    }),
    5 * 60 * 1000
  )
  assert.equal(
    networkAlarmMttaMs({
      createdAt: "2026-12-03T10:00:00.000Z",
      acknowledgedAt: null,
    }),
    null
  )
})

test("20: MTTR = resolved_at - created_at y no usa seen_at", () => {
  assert.equal(
    networkAlarmMttrMs({
      createdAt: "2026-12-03T10:00:00.000Z",
      resolvedAt: "2026-12-03T10:20:00.000Z",
    }),
    20 * 60 * 1000
  )
  const mttaFromSeen = networkAlarmMttaMs({
    createdAt: "2026-12-03T10:00:00.000Z",
    acknowledgedAt: null,
  })
  assert.equal(mttaFromSeen, null)
})

test("21: alarma ya abierta no se duplica", async () => {
  const client = createMemoryClient()
  await bringOffline(client, CORE)
  const firstId = activeAlarms(client, CORE)[0].id
  await persistDevice(client, CORE, { success: false, errorMessage: "still-down" })
  assert.equal(activeAlarms(client, CORE).length, 1)
  assert.equal(activeAlarms(client, CORE)[0].id, firstId)
  assert.equal(client.db.network_alarms.length, 1)
})

test("22: decrypt failure no monopoliza auto-poll", async () => {
  const client = createMemoryClient()
  const first = await persistDevice(client, CORE, {
    success: false,
    errorCode: MONITORING_DECRYPT_ERROR_CODE,
    errorMessage: "No se pudo descifrar la credencial del destino.",
  })
  assert.equal(first.consecutiveFailures, 1)
  const status = client.db.network_device_status.find((row) => row.device_id === CORE)
  assert.ok(status.last_poll_at)
  assert.equal(status.error_code, MONITORING_DECRYPT_ERROR_CODE)
  const polledAt = Date.parse(status.last_poll_at)
  assert.equal(isMonitoringDeviceDue(status.last_poll_at, polledAt + 1_000), false)
  assert.equal(isMonitoringDeviceDue(status.last_poll_at, polledAt + 60_000), true)

  const picked = pickDueMonitoringDevice([
    { deviceId: CORE, lastPollAt: polledAt },
    { deviceId: POWERBOX, lastPollAt: 0 },
  ])
  assert.equal(picked.deviceId, POWERBOX)

  const execution = read("lib/network/jobs/agent-execution.ts")
  assert.match(execution, /MONITORING_DECRYPT_ERROR_CODE/)
  assert.match(execution, /execution\.error === NETWORK_TARGET_DECRYPT_ERROR/)
  const monitoringClaimStart = execution.indexOf("MONITORING_EXECUTABLE_JOB_TYPE")
  const monitoringClaim = execution.slice(
    monitoringClaimStart,
    execution.indexOf("Este tipo de job todavía no está autorizado", monitoringClaimStart)
  )
  assert.match(monitoringClaim, /persistMonitoringSnapshot/)
  const discoveryClaim = execution.slice(
    0,
    execution.indexOf("MONITORING_EXECUTABLE_JOB_TYPE")
  )
  assert.doesNotMatch(
    discoveryClaim.slice(discoveryClaim.lastIndexOf("DISCOVERY_EXECUTABLE_JOB_TYPE")),
    /errorCode: MONITORING_DECRYPT_ERROR_CODE/
  )
})

test("23: Discovery no modifica alarmas directamente", () => {
  const discoveryQueries = read("lib/network/devices/queries.ts")
  const persistStart = discoveryQueries.indexOf("export async function persistDiscoverySnapshot")
  const persistFn = discoveryQueries.slice(persistStart)
  assert.doesNotMatch(persistFn, /network_alarms/)
  assert.doesNotMatch(persistFn, /syncNetworkAlarmsAfterMonitoringTransition/)
  assert.doesNotMatch(persistFn, /evaluateNetworkAlarmTransition/)

  const migration = read("supabase/migrations/20261231000300_network_alarms_1_0.sql")
  assert.match(migration, /CREATE TABLE public.network_alarms/)
  assert.doesNotMatch(migration, /ALTER TABLE public.network_devices/)
  assert.doesNotMatch(migration, /ALTER TABLE public.network_links/)
  assert.doesNotMatch(migration, /ALTER TABLE public.network_device_status /)
})

test("24: CPE observado por Discovery no genera alarma", async () => {
  const client = createMemoryClient()
  client.db.network_devices.find((row) => row.id === CPE).agent_id = null
  await bringOffline(client, CPE)
  assert.equal(client.db.network_alarms.length, 0)
  assert.equal(
    nextMonitoringOperationalState({
      previousStatus: "online",
      consecutiveFailures: 2,
      success: false,
    }).status,
    "offline"
  )
})

test("APIs de seen/ack/resolve existen bajo /api/network/v1/alarms", () => {
  assert.match(read("app/api/network/v1/alarms/route.ts"), /listNetworkAlarms/)
  assert.match(read("app/api/network/v1/alarms/[alarmId]/route.ts"), /getNetworkAlarm/)
  assert.match(read("app/api/network/v1/alarms/[alarmId]/seen/route.ts"), /markNetworkAlarmSeen/)
  assert.match(
    read("app/api/network/v1/alarms/[alarmId]/acknowledge/route.ts"),
    /acknowledgeNetworkAlarm/
  )
  assert.match(read("app/api/network/v1/alarms/[alarmId]/resolve/route.ts"), /resolveNetworkAlarm/)
})

test("el rol no se decide por hostname", () => {
  const role = read("lib/network/alarms/role.ts")
  assert.doesNotMatch(role, /Malagueño|PowerBox Malagueño|\bAS5\b|\bAS6\b|\bAS7\b/i)
  assert.doesNotMatch(role, /hostname/)
})

test("Alarmas está en subnav, Resumen y /network/alarms", () => {
  const subnav = read("components/network/network-subnav.tsx")
  assert.match(subnav, /href: "\/network\/alarms"/)
  assert.match(subnav, /label: "Alarmas"/)
  const nocIdx = subnav.indexOf('id: "noc"')
  const alarmsIdx = subnav.indexOf('id: "alarms"')
  const discoveryIdx = subnav.indexOf('id: "discovery"')
  assert.ok(nocIdx >= 0 && alarmsIdx > nocIdx && discoveryIdx > alarmsIdx)

  const home = read("components/network/network-home-screen.tsx")
  assert.match(home, /useNetworkAlarmsQuery/)
  assert.match(home, /href="\/network\/alarms"/)
  assert.match(home, /Alarmas activas/)
  assert.match(home, /críticas/)
  assert.match(home, /warnings/)
  assert.doesNotMatch(home, /acknowledge|resolve/)

  assert.match(
    read("app/(dashboard)/network/alarms/page.tsx"),
    /NetworkAlarmsScreen/
  )
  assert.match(
    read("components/network/network-alarms-screen.tsx"),
    /useNetworkAlarmsQuery/
  )
  const hook = read("lib/network/react-query/use-network-alarms-query.ts")
  assert.match(hook, /\/api\/network\/v1\/alarms/)
  assert.match(read("lib/network/react-query/keys.ts"), /alarms: \(\) =>/)
})
