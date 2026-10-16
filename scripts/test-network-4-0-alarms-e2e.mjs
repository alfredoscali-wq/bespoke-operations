import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  acknowledgeNetworkAlarm,
  getNetworkAlarm,
  listNetworkAlarms,
  resolveNetworkAlarm,
} from "../lib/network/alarms/queries.ts"
import { isActiveNetworkAlarmStatus } from "../lib/network/alarms/contract.ts"
import { syncNetworkAlarmsAfterMonitoringTransition } from "../lib/network/alarms/sync.ts"

const COMPANY_ID = "00000000-0000-4000-8000-00000000e2e1"
const AGENT_ID = "00000000-0000-4000-8000-00000000e2e2"
const ACTOR = {
  employeeId: "00000000-0000-4000-8000-00000000e2e3",
  authUserId: "00000000-0000-4000-8000-00000000e2e4",
}
const MARKER = "TEST-ALARM"
const NOW = "2026-04-10T20:00:00.000Z"
const ACK_AT = "2026-04-10T20:01:00.000Z"
const RESOLVE_AT = "2026-04-10T20:02:00.000Z"
const ROOT = resolve(import.meta.dirname, "..")

const CORE = {
  id: randomUUID(),
  hostname: `${MARKER}-CORE`,
  deviceType: "core",
  ip: "192.0.2.10",
}
const AP = {
  id: randomUUID(),
  hostname: `${MARKER}-AP`,
  deviceType: "radio",
  ip: "192.0.2.20",
}
const CPE = {
  id: randomUUID(),
  hostname: `${MARKER}-CPE`,
  deviceType: "cpe",
  ip: "192.0.2.30",
}
const UNKNOWN = {
  id: randomUUID(),
  hostname: `${MARKER}-UNKNOWN`,
  deviceType: "core",
  ip: "192.0.2.40",
}

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function matches(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col]
    if (filter.op === "is") return value === filter.val
    if (filter.op === "neq") return value !== filter.val
    return value === filter.val
  })
}

function deviceRow(spec) {
  return {
    id: spec.id,
    company_id: COMPANY_ID,
    agent_id: AGENT_ID,
    management_ip: spec.ip,
    device_type: spec.deviceType,
    hostname: spec.hostname,
    fingerprint: `test-alarm-e2e/${spec.hostname}`,
    origin: "discovery",
    status: "unknown",
    deleted_at: null,
  }
}

function targetRow(spec) {
  return {
    id: randomUUID(),
    company_id: COMPANY_ID,
    agent_id: AGENT_ID,
    host: spec.ip,
    name: spec.hostname,
    deleted_at: null,
  }
}

function createIsolatedClient() {
  const db = {
    network_devices: [CORE, AP, CPE, UNKNOWN].map(deviceRow),
    network_discovery_targets: [CORE, AP, CPE, UNKNOWN].map(targetRow),
    network_alarms: [],
  }
  let seq = 1

  function from(table) {
    if (!db[table]) db[table] = []
    const state = {
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
        return { data: matched, error: null }
      }
      if (state.type === "insert") {
        if (table === "network_alarms") {
          const status = state.row.status
          if (status === "open" || status === "acknowledged") {
            const exists = rows.some(
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
        const inserted = { deleted_at: null, id: state.row.id ?? `row-${seq++}`, ...state.row }
        rows.push(inserted)
        if (mode === "maybeSingle") return { data: inserted, error: null }
        return { data: [inserted], error: null }
      }
      return { data: null, error: null }
    }

    return chain
  }

  return { from, db }
}

function activeRows(client, deviceId) {
  return client.db.network_alarms.filter(
    (row) =>
      row.deleted_at == null &&
      (row.status === "open" || row.status === "acknowledged") &&
      (deviceId ? row.device_id === deviceId : true)
  )
}

function rowsFor(client, deviceId) {
  return client.db.network_alarms.filter(
    (row) => row.deleted_at == null && row.device_id === deviceId
  )
}

async function transition(client, device, previousStatus, nextStatus) {
  await syncNetworkAlarmsAfterMonitoringTransition(client, {
    companyId: COMPANY_ID,
    deviceId: device.id,
    previousStatus,
    nextStatus,
    occurredAt: NOW,
  })
}

function projectAlarmsScreen(alarms) {
  const active = alarms
    .filter((alarm) => isActiveNetworkAlarmStatus(alarm.status))
    .sort((left, right) => {
      if (left.severity === "critical" && right.severity !== "critical") return -1
      if (right.severity === "critical" && left.severity !== "critical") return 1
      return Date.parse(right.createdAt) - Date.parse(left.createdAt)
    })
  const history = alarms
    .filter((alarm) => alarm.status === "resolved")
    .sort(
      (left, right) =>
        Date.parse(right.resolvedAt ?? right.createdAt) -
        Date.parse(left.resolvedAt ?? left.createdAt)
    )
  return {
    active,
    history,
    criticalActive: active.filter((alarm) => alarm.severity === "critical").length,
    warningActive: active.filter((alarm) => alarm.severity === "warning").length,
    acknowledged: active.filter((alarm) => alarm.status === "acknowledged").length,
  }
}

function projectNoc(alarms, newCriticalIds, topologyIds) {
  const screen = projectAlarmsScreen(alarms)
  const overlay = new Map()
  for (const alarm of screen.active) {
    const current = overlay.get(alarm.deviceId)
    if (current === "critical") continue
    if (alarm.severity === "critical" || !current) {
      overlay.set(alarm.deviceId, alarm.severity)
    }
  }
  const nuevaDevices = new Set(
    screen.active
      .filter((alarm) => newCriticalIds.has(alarm.id) && alarm.severity === "critical")
      .map((alarm) => alarm.deviceId)
  )
  const untouched = [...topologyIds].filter((id) => !overlay.has(id))
  return {
    activeCount: screen.active.length,
    criticalCount: screen.criticalActive,
    warningCount: screen.warningActive,
    showCriticalBanner: screen.criticalActive > 0,
    overlay,
    nuevaDevices,
    untouched,
  }
}

function detectNewCriticals(knownIds, activeAlarms) {
  if (knownIds.current == null) {
    knownIds.current = new Set(activeAlarms.map((alarm) => alarm.id))
    return new Set()
  }
  const incoming = new Set()
  for (const alarm of activeAlarms) {
    if (
      !knownIds.current.has(alarm.id) &&
      alarm.severity === "critical" &&
      alarm.status === "open"
    ) {
      incoming.add(alarm.id)
    }
    knownIds.current.add(alarm.id)
  }
  return incoming
}

const results = []

async function record(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`${name}: PASS`)
  } catch (error) {
    results.push({ name, ok: false, error })
    console.log(`${name}: FAIL`)
    console.log(`  ${error instanceof Error ? error.message : error}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const topologyIds = [CORE.id, AP.id, CPE.id, UNKNOWN.id]
const labels = new Map([
  [CORE.id, CORE.hostname],
  [AP.id, AP.hostname],
  [CPE.id, CPE.hostname],
  [UNKNOWN.id, UNKNOWN.hostname],
])
const client = createIsolatedClient()
const knownIds = { current: null }
const newCriticalIds = new Set()

await record("source contract: NOC y Alarmas usan GET /api/network/v1/alarms", () => {
  const api = read("app/api/network/v1/alarms/route.ts")
  const hook = read("lib/network/react-query/use-network-alarms-query.ts")
  const noc = read("components/network/noc-monitor-screen.tsx")
  const alarms = read("components/network/network-alarms-screen.tsx")
  assert(api.includes("listNetworkAlarms"), "GET alarms no usa listNetworkAlarms")
  assert(hook.includes('fetch("/api/network/v1/alarms")'), "hook no llama GET alarms")
  assert(hook.includes("/acknowledge"), "hook no llama acknowledge")
  assert(hook.includes("/resolve"), "hook no llama resolve")
  assert(noc.includes("useNetworkAlarmsQuery"), "NOC no reutiliza la query de alarmas")
  assert(!noc.includes("data.alarms"), "NOC no debe usar el array vacío del endpoint NOC")
  assert(alarms.includes("useNetworkAlarmsQuery"), "Alarmas no reutiliza la query")
  assert(
    read("app/api/network/v1/alarms/[alarmId]/acknowledge/route.ts").includes(
      "acknowledgeNetworkAlarm"
    ),
    "POST acknowledge desconectado"
  )
  assert(
    read("app/api/network/v1/alarms/[alarmId]/resolve/route.ts").includes(
      "resolveNetworkAlarm"
    ),
    "POST resolve desconectado"
  )
})

const emptyList = await listNetworkAlarms(client, COMPANY_ID)
detectNewCriticals(knownIds, projectAlarmsScreen(emptyList).active)

await transition(client, CORE, "online", "offline")
const afterOpen = await listNetworkAlarms(client, COMPANY_ID)
const incoming = detectNewCriticals(knownIds, projectAlarmsScreen(afterOpen).active)
for (const id of incoming) newCriticalIds.add(id)

await record("fase 1: crear alarma crítica ficticia TEST-ALARM-CORE", async () => {
  const rows = activeRows(client, CORE.id)
  assert(rows.length === 1, `expected 1 active alarm, got ${rows.length}`)
  assert(rows[0].device_id === CORE.id, "device_id mismatch")
  assert(rows[0].severity === "critical", `severity ${rows[0].severity}`)
  assert(rows[0].status === "open", `status ${rows[0].status}`)
  const listed = afterOpen.filter((alarm) => alarm.deviceId === CORE.id)
  assert(listed.length === 1, "listNetworkAlarms duplicó CORE")
  assert(listed[0].id === rows[0].id, "GET list id mismatch")
  assert(listed[0].title.length > 0, "missing title")
  assert(listed[0].message.length > 0, "missing message")
})

await transition(client, CORE, "offline", "offline")
await record("fase 1: no duplicar alarma activa", () => {
  assert(rowsFor(client, CORE.id).length === 1, "segunda alarma creada")
  assert(activeRows(client, CORE.id).length === 1, "active count changed")
})

const coreAlarmId = activeRows(client, CORE.id)[0].id

await record("fase 2: NOC proyecta la misma alarma", async () => {
  const listed = await listNetworkAlarms(client, COMPANY_ID)
  const noc = projectNoc(listed, newCriticalIds, topologyIds)
  assert(noc.activeCount === 1, `activeCount ${noc.activeCount}`)
  assert(noc.criticalCount === 1, `criticalCount ${noc.criticalCount}`)
  assert(noc.warningCount === 0, `warningCount ${noc.warningCount}`)
  assert(noc.showCriticalBanner, "faltó banner crítico")
  assert(noc.overlay.get(CORE.id) === "critical", "CORE no quedó rojo")
  assert(noc.nuevaDevices.has(CORE.id), "faltó NUEVA en CORE")
  assert(noc.untouched.includes(AP.id), "AP no debía cambiar")
  assert(noc.untouched.includes(CPE.id), "CPE no debía cambiar")
  assert(noc.untouched.includes(UNKNOWN.id), "UNKNOWN no debía cambiar")
  assert(labels.get(CORE.id) === `${MARKER}-CORE`, "label CORE incorrecto")
})

await record("fase 3: /network/alarms muestra el mismo alarmId", async () => {
  const listed = await listNetworkAlarms(client, COMPANY_ID)
  const screen = projectAlarmsScreen(listed)
  assert(screen.active.length === 1, `active ${screen.active.length}`)
  const alarm = screen.active[0]
  assert(alarm.id === coreAlarmId, "alarmId distinto entre NOC y Alarmas")
  assert(alarm.deviceId === CORE.id, "deviceId distinto")
  assert(alarm.severity === "critical", `severity ${alarm.severity}`)
  assert(alarm.status === "open", `status ${alarm.status}`)
  assert(alarm.title.length > 0, "sin título")
  assert(alarm.message.length > 0, "sin mensaje")
  assert(screen.history.length === 0, "historial no debía tener activas")
  const detail = await getNetworkAlarm(client, COMPANY_ID, coreAlarmId)
  assert(detail?.id === coreAlarmId, "GET by id distinto")
})

const ack = await acknowledgeNetworkAlarm(client, {
  companyId: COMPANY_ID,
  alarmId: coreAlarmId,
  actor: ACTOR,
  acknowledgedAt: ACK_AT,
})
await record("fase 4: reconocer", async () => {
  assert(ack.ok, "acknowledge falló")
  if (!ack.ok) return
  assert(ack.alarm.id === coreAlarmId, "acknowledge cambió el id")
  assert(ack.alarm.status === "acknowledged", `status ${ack.alarm.status}`)
  assert(ack.alarm.severity === "critical", "perdió severidad")
  assert(ack.alarm.acknowledgedAt === ACK_AT, "faltó acknowledgedAt")
  assert(activeRows(client, CORE.id).length === 1, "dejó de estar activa")
  assert(rowsFor(client, CORE.id).length === 1, "se creó otra alarma al reconocer")
  const listed = await listNetworkAlarms(client, COMPANY_ID)
  const noc = projectNoc(listed, newCriticalIds, topologyIds)
  const screen = projectAlarmsScreen(listed)
  assert(noc.activeCount === 1, "NOC dejó de contar la reconocida")
  assert(noc.overlay.get(CORE.id) === "critical", "NOC perdió el rojo")
  assert(screen.active[0]?.id === coreAlarmId, "Alarmas perdió el mismo id")
  assert(screen.active[0]?.status === "acknowledged", "Alarmas no muestra reconocida")
  assert(screen.history.length === 0, "reconocida no debe ir a historial")
})

const resolved = await resolveNetworkAlarm(client, {
  companyId: COMPANY_ID,
  alarmId: coreAlarmId,
  actor: ACTOR,
  resolvedAt: RESOLVE_AT,
})
await record("fase 5: resolver", async () => {
  assert(resolved.ok, "resolve falló")
  if (!resolved.ok) return
  assert(resolved.alarm.id === coreAlarmId, "resolve cambió el id")
  assert(resolved.alarm.status === "resolved", `status ${resolved.alarm.status}`)
  assert(resolved.alarm.resolvedAt === RESOLVE_AT, "faltó resolvedAt")
  assert(activeRows(client, CORE.id).length === 0, "sigue activa")
  const listed = await listNetworkAlarms(client, COMPANY_ID)
  const noc = projectNoc(listed, newCriticalIds, topologyIds)
  assert(noc.activeCount === 0, "NOC sigue contando activas")
  assert(!noc.showCriticalBanner, "banner crítico persistió")
  assert(!noc.overlay.has(CORE.id), "nodo CORE sigue con overlay de alarma")
  assert(noc.untouched.includes(CORE.id), "CORE no volvió a Monitoring-only")
})

await record("fase 6: historial", async () => {
  const listed = await listNetworkAlarms(client, COMPANY_ID)
  const screen = projectAlarmsScreen(listed)
  assert(screen.active.length === 0, "sigue en activas")
  assert(screen.history.length === 1, `historial ${screen.history.length}`)
  const item = screen.history[0]
  assert(item.id === coreAlarmId, "historial usó otro alarmId")
  assert(item.deviceId === CORE.id, "historial deviceId incorrecto")
  assert(item.severity === "critical", `historial severity ${item.severity}`)
  assert(item.status === "resolved", `historial status ${item.status}`)
  assert(item.createdAt != null, "faltó createdAt")
  assert(item.resolvedAt === RESOLVE_AT, "faltó resolvedAt")
})

await transition(client, CORE, "online", "offline")
await transition(client, AP, "online", "offline")
const afterIndependent = await listNetworkAlarms(client, COMPANY_ID)
const coreOpen = afterIndependent.find((alarm) => alarm.deviceId === CORE.id && isActiveNetworkAlarmStatus(alarm.status))
const apOpen = afterIndependent.find((alarm) => alarm.deviceId === AP.id && isActiveNetworkAlarmStatus(alarm.status))

await record("fase 7: independencia — ambas aparecen", async () => {
  assert(coreOpen != null, "faltó CORE")
  assert(apOpen != null, "faltó AP")
  assert(coreOpen.id !== apOpen.id, "comparten alarmId")
  assert(coreOpen.id !== coreAlarmId, "CORE reabrió el id resuelto")
  const noc = projectNoc(afterIndependent, new Set(), topologyIds)
  assert(noc.activeCount === 2, `activeCount ${noc.activeCount}`)
  assert(noc.criticalCount === 1, "CORE no es crítica")
  assert(noc.warningCount === 1, "AP no es warning")
  assert(noc.overlay.get(CORE.id) === "critical", "CORE no rojo")
  assert(noc.overlay.get(AP.id) === "warning", "AP no ámbar")
  assert(noc.untouched.includes(CPE.id), "CPE cambió")
})

const ackCoreOnly = await acknowledgeNetworkAlarm(client, {
  companyId: COMPANY_ID,
  alarmId: coreOpen.id,
  actor: ACTOR,
  acknowledgedAt: ACK_AT,
})
await record("fase 7: reconocer una no cambia la otra", async () => {
  assert(ackCoreOnly.ok, "ack CORE falló")
  const listed = await listNetworkAlarms(client, COMPANY_ID)
  const core = listed.find((alarm) => alarm.id === coreOpen.id)
  const ap = listed.find((alarm) => alarm.id === apOpen.id)
  assert(core?.status === "acknowledged", "CORE no quedó reconocida")
  assert(ap?.status === "open", `AP cambió a ${ap?.status}`)
  assert(ap?.id === apOpen.id, "AP cambió de id")
})

const resolveCoreOnly = await resolveNetworkAlarm(client, {
  companyId: COMPANY_ID,
  alarmId: coreOpen.id,
  actor: ACTOR,
  resolvedAt: RESOLVE_AT,
})
await record("fase 7: resolver una no resuelve la otra", async () => {
  assert(resolveCoreOnly.ok, "resolve CORE falló")
  const listed = await listNetworkAlarms(client, COMPANY_ID)
  const screen = projectAlarmsScreen(listed)
  const noc = projectNoc(listed, new Set(), topologyIds)
  assert(screen.active.length === 1, `active ${screen.active.length}`)
  assert(screen.active[0].id === apOpen.id, "quedó otra alarma que no es AP")
  assert(screen.active[0].status === "open", "AP no sigue open")
  assert(noc.overlay.get(AP.id) === "warning", "AP desapareció del NOC")
  assert(!noc.overlay.has(CORE.id), "CORE resuelto sigue en overlay")
  assert(screen.history.some((alarm) => alarm.id === coreOpen.id), "CORE no fue a historial")
})

await transition(client, AP, "offline", "online")
await transition(client, CPE, "online", "offline")
await transition(client, UNKNOWN, "unknown", "offline")
await record("guards: CPE y unknown no crean alarma", () => {
  assert(rowsFor(client, CPE.id).length === 0, "CPE creó alarma")
  assert(rowsFor(client, UNKNOWN.id).length === 0, "unknown→offline creó alarma")
  assert(activeRows(client).length === 0, "quedaron alarmas activas antes del cleanup")
})

await record("fase 8: cleanup", () => {
  const testHostnames = new Set([CORE.hostname, AP.hostname, CPE.hostname, UNKNOWN.hostname])
  for (const row of client.db.network_devices) {
    assert(testHostnames.has(row.hostname), `dispositivo no ficticio: ${row.hostname}`)
    assert(String(row.hostname).startsWith(MARKER), `hostname fuera de ${MARKER}`)
    row.deleted_at = NOW
  }
  for (const row of client.db.network_discovery_targets) {
    assert(String(row.name).startsWith(MARKER), `target no ficticio: ${row.name}`)
    row.deleted_at = NOW
  }
  for (const row of client.db.network_alarms) {
    const device = client.db.network_devices.find((item) => item.id === row.device_id)
    assert(device && testHostnames.has(device.hostname), "alarma de dispositivo no ficticio")
    row.deleted_at = NOW
  }
  assert(
    client.db.network_alarms.every((row) => row.deleted_at != null),
    "alarmas no limpiadas"
  )
  assert(
    activeRows(client).length === 0,
    "quedaron alarmas ficticias activas"
  )
  assert(
    client.db.network_devices.every((row) => row.deleted_at != null),
    "devices no limpiados"
  )
})

const passed = results.filter((row) => row.ok).length
const total = results.length
console.log(`ALARMAS 1.0 E2E CIRCUITO: ${passed}/${total} PASS`)
if (passed !== total) process.exitCode = 1
