/**
 * Temporary TEST-FCM-ALARM tool.
 * Does not send live FCM. The dispatcher is mocked in behavioral tests.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { isManagedNetworkDevice } from "../lib/network/devices/managed.ts"
import {
  TEST_FCM_ALARM_MARKER,
  TEST_FCM_ALARM_MESSAGE,
  TEST_FCM_ALARM_TITLE,
  cleanupTestFcmNetworkAlarm,
  createTestFcmNetworkAlarm,
  testFcmAlarmFingerprint,
} from "../lib/network/alarms/test-fcm.ts"

const ROOT = resolve(import.meta.dirname, "..")
const COMPANY_A = "00000000-0000-4000-8000-00000000fc01"
const COMPANY_B = "00000000-0000-4000-8000-00000000fc02"
const REAL_DEVICE_ID = "00000000-0000-4000-8000-00000000fc11"
const REAL_ALARM_ID = "00000000-0000-4000-8000-00000000fc21"
const AGENT_ID = "00000000-0000-4000-8000-00000000fc31"
const NOW = "2026-10-05T21:00:00.000Z"

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function matches(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col]
    if (filter.op === "is") return value === filter.val
    if (filter.op === "neq") return value !== filter.val
    if (filter.op === "in") return Array.isArray(filter.val) && filter.val.includes(value)
    return value === filter.val
  })
}

function createIsolatedClient(seed = {}) {
  const db = {
    network_devices: [],
    network_alarms: [],
    network_alarm_events: [],
    network_discovery_targets: [],
    network_topology_placements: [],
    network_agent_jobs: [],
    ...seed,
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
        if (mode === "maybeSingle") return { data: found[0] ?? null, error: null }
        return { data: found, error: null }
      }
      if (state.type === "update") {
        const matched = rows.filter((row) => matches(row, state.filters))
        for (const row of matched) Object.assign(row, state.patch)
        if (mode === "maybeSingle") return { data: matched[0] ?? null, error: null }
        return { data: matched, error: null }
      }
      if (state.type === "insert") {
        if (table === "network_alarms") {
          const status = state.row.status
          if (status === "open" || status === "acknowledged") {
            const exists = rows.some(
              (row) =>
                row.company_id === state.row.company_id &&
                row.device_id === state.row.device_id &&
                row.deleted_at == null &&
                (row.status === "open" || row.status === "acknowledged")
            )
            if (exists) {
              return { data: null, error: { code: "23505", message: "duplicate key" } }
            }
          }
        }
        const inserted = {
          deleted_at: null,
          ...state.row,
          id: state.row.id ?? `row-${seq++}`,
        }
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

function mockedPush(overrides = {}) {
  return {
    attempted: true,
    outcome: "sent",
    recipientCount: 2,
    sent: 2,
    failed: 0,
    invalidTokens: 0,
    ...overrides,
  }
}

test("contrato: ruta temporal protegida, tenant de sesión, sin push/test", () => {
  const route = read("app/api/network/alarms/test-fcm/route.ts")
  const service = read("lib/network/alarms/test-fcm.ts")
  const send = read("lib/network/push/send-alarm.ts")

  assert.match(route, /requireNetworkWriteContext/)
  assert.match(route, /isAdministradorSessionUser/)
  assert.match(route, /canAccessNetworkModule|requireNetworkWriteContext/)
  assert.match(route, /auth\.companyId/)
  assert.doesNotMatch(route, /body\.companyId|requestedCompanyId|searchParams\.get\(["']companyId["']\)/)
  assert.match(route, /Ignore any companyId in the body|companyId in the body/)
  assert.match(route, /export async function POST/)
  assert.match(route, /export async function DELETE/)
  assert.match(route, /alarmId: result\.alarmId/)
  assert.match(route, /recipientCount: result\.recipientCount/)
  assert.match(route, /outcome: result\.outcome/)
  assert.doesNotMatch(route, /pushToken|tokens|FIREBASE_SERVICE_ACCOUNT/)
  assert.doesNotMatch(route, /app\/api\/network\/push\/test/)

  assert.match(service, /notifyNetworkAlarmOpened/)
  assert.match(service, /applyNetworkAlarmActions/)
  assert.match(service, /TEST-FCM-ALARM/)
  assert.match(service, /PRUEBA FCM — ALARMA CRITICAL/)
  assert.match(service, /origin: "neighbor"/)
  assert.match(service, /management_ip: null/)
  assert.match(service, /agent_id: null/)
  assert.match(service, /eq\("fingerprint", testFcmAlarmFingerprint\(companyId\)\)/)
  assert.doesNotMatch(service, /eq\("hostname", TEST_FCM_ALARM_MARKER\)/)
  assert.doesNotMatch(service, /syncNetworkAlarmsAfterMonitoringTransition/)
  assert.doesNotMatch(service, /network_discovery_targets/)
  assert.doesNotMatch(service, /network_topology_placements/)
  assert.doesNotMatch(service, /network_agent_jobs/)
  assert.doesNotMatch(service, /sendNetworkAlarmPush/)
  assert.doesNotMatch(service, /pushToken/)

  assert.match(send, /export async function notifyNetworkAlarmOpened/)
  assert.equal(existsSync(resolve(ROOT, "app/api/network/push/test/route.ts")), false)
})

test("1: endpoint protegido — el contrato exige write + admin + Network", () => {
  const route = read("app/api/network/alarms/test-fcm/route.ts")
  const context = read("lib/network/route-context.ts")
  assert.match(route, /requireTestFcmAlarmContext/)
  assert.match(context, /requireWritablePlatformSession/)
  assert.match(context, /canAccessNetworkModule/)
  assert.match(
    read("lib/roles/web-module-access.ts"),
    /export function isAdministradorSessionUser/
  )
})

test("2: companyId derivado de sesión, no del body", async () => {
  const client = createIsolatedClient()
  const notified = []
  const result = await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async (_client, alarm) => {
      notified.push(alarm)
      return mockedPush()
    },
  })
  assert.equal(result.alarmId, "alarm-test-a")
  assert.equal(client.db.network_alarms[0].company_id, COMPANY_A)
  assert.equal(client.db.network_devices[0].company_id, COMPANY_A)
  assert.equal(notified[0].companyId, COMPANY_A)
  assert.equal(
    client.db.network_devices[0].fingerprint,
    testFcmAlarmFingerprint(COMPANY_A)
  )
})

test("3: dispositivo ficticio TEST-FCM-ALARM, no managed / no discovery", async () => {
  const client = createIsolatedClient({
    network_devices: [
      {
        id: REAL_DEVICE_ID,
        company_id: COMPANY_A,
        agent_id: AGENT_ID,
        fingerprint: "real-core",
        hostname: "CORE-1",
        management_ip: "10.0.0.1",
        origin: "discovery",
        deleted_at: null,
      },
    ],
    network_discovery_targets: [
      {
        id: "tgt-1",
        company_id: COMPANY_A,
        agent_id: AGENT_ID,
        host: "10.0.0.1",
        deleted_at: null,
      },
    ],
  })

  await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async () => mockedPush(),
  })

  const fictional = client.db.network_devices.find(
    (row) => row.hostname === TEST_FCM_ALARM_MARKER
  )
  assert.ok(fictional)
  assert.equal(fictional.agent_id, null)
  assert.equal(fictional.management_ip, null)
  assert.equal(fictional.origin, "neighbor")
  assert.equal(fictional.device_type, "other")
  assert.notEqual(fictional.id, REAL_DEVICE_ID)
  assert.equal(
    isManagedNetworkDevice(
      {
        companyId: fictional.company_id,
        agentId: fictional.agent_id,
        managementIp: fictional.management_ip,
      },
      { companyId: COMPANY_A, agentId: AGENT_ID, host: "10.0.0.1" }
    ),
    false
  )
  assert.equal(client.db.network_discovery_targets.length, 1)
  assert.equal(client.db.network_topology_placements.length, 0)
  assert.equal(client.db.network_agent_jobs.length, 0)
  assert.equal(
    client.db.network_devices.find((row) => row.id === REAL_DEVICE_ID).hostname,
    "CORE-1"
  )
})

test("hostname TEST-FCM-ALARM en un dispositivo real no se reutiliza ni se borra", async () => {
  const client = createIsolatedClient({
    network_devices: [
      {
        id: REAL_DEVICE_ID,
        company_id: COMPANY_A,
        agent_id: AGENT_ID,
        fingerprint: "real-core",
        hostname: TEST_FCM_ALARM_MARKER,
        management_ip: "10.0.0.1",
        origin: "discovery",
        deleted_at: null,
      },
    ],
  })

  await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async () => mockedPush(),
  })
  await cleanupTestFcmNetworkAlarm(client, COMPANY_A, NOW)

  const real = client.db.network_devices.find((row) => row.id === REAL_DEVICE_ID)
  const fictional = client.db.network_devices.find(
    (row) => row.fingerprint === testFcmAlarmFingerprint(COMPANY_A)
  )
  assert.equal(real.deleted_at, null)
  assert.equal(real.agent_id, AGENT_ID)
  assert.equal(real.management_ip, "10.0.0.1")
  assert.notEqual(fictional.id, REAL_DEVICE_ID)
  assert.equal(fictional.deleted_at, NOW)
  assert.equal(
    client.db.network_alarms.find((row) => row.id === "alarm-test-a").device_id,
    fictional.id
  )
})

test("4: crea network_alarm critical/open con título de prueba", async () => {
  const client = createIsolatedClient()
  const result = await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async () => mockedPush(),
  })
  assert.equal(result.alarmId, "alarm-test-a")
  const alarm = client.db.network_alarms.find((row) => row.id === "alarm-test-a")
  assert.ok(alarm)
  assert.equal(alarm.severity, "critical")
  assert.equal(alarm.status, "open")
  assert.equal(alarm.title, TEST_FCM_ALARM_TITLE)
  assert.equal(alarm.message, TEST_FCM_ALARM_MESSAGE)
  assert.equal(alarm.company_id, COMPANY_A)
  assert.equal(alarm.deleted_at, null)
  assert.equal(alarm.device_id, client.db.network_devices[0].id)
})

test("5: escribe evento created con el mecanismo existente", async () => {
  const client = createIsolatedClient()
  await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async () => mockedPush(),
  })
  const events = client.db.network_alarm_events.filter(
    (row) => row.alarm_id === "alarm-test-a"
  )
  assert.equal(events.length, 1)
  assert.equal(events[0].event_type, "created")
  assert.equal(events[0].company_id, COMPANY_A)
  assert.equal(events[0].user_id, null)
})

test("6: llama al dispatcher real notifyNetworkAlarmOpened (mockeado, sin FCM live)", async () => {
  const client = createIsolatedClient()
  const notified = []
  await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async (nextClient, alarm) => {
      notified.push({ client: nextClient, alarm })
      return mockedPush({ recipientCount: 3, sent: 2, failed: 1 })
    },
  })
  assert.equal(notified.length, 1)
  assert.equal(notified[0].alarm.id, "alarm-test-a")
  assert.equal(notified[0].alarm.severity, "critical")
  assert.equal(notified[0].alarm.title, TEST_FCM_ALARM_TITLE)
  assert.equal(notified[0].client, client)
})

test("7: respuesta con alarmId y resultado FCM, sin tokens", async () => {
  const client = createIsolatedClient()
  const result = await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async () =>
      mockedPush({ recipientCount: 4, sent: 3, failed: 1, outcome: "sent" }),
  })
  assert.deepEqual(result, {
    alarmId: "alarm-test-a",
    recipientCount: 4,
    sent: 3,
    failed: 1,
    outcome: "sent",
  })
  assert.equal("pushToken" in result, false)
  assert.equal("tokens" in result, false)
  assert.equal("invalidTokens" in result, false)
})

test("8: aislamiento tenant — B no toca filas de A", async () => {
  const client = createIsolatedClient({
    network_devices: [
      {
        id: REAL_DEVICE_ID,
        company_id: COMPANY_A,
        agent_id: AGENT_ID,
        fingerprint: "real-core",
        hostname: "CORE-1",
        management_ip: "10.0.0.1",
        origin: "discovery",
        deleted_at: null,
      },
    ],
    network_alarms: [
      {
        id: REAL_ALARM_ID,
        company_id: COMPANY_A,
        device_id: REAL_DEVICE_ID,
        severity: "critical",
        status: "open",
        title: "Core offline",
        message: "El core no responde.",
        deleted_at: null,
      },
    ],
  })

  await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-a",
    notifyOpened: async () => mockedPush(),
  })
  await createTestFcmNetworkAlarm(client, COMPANY_B, {
    now: () => NOW,
    createId: () => "alarm-b",
    notifyOpened: async () => mockedPush(),
  })

  const cleanupB = await cleanupTestFcmNetworkAlarm(client, COMPANY_B, NOW)
  assert.equal(cleanupB.alarmIds.includes("alarm-b"), true)
  assert.equal(cleanupB.alarmIds.includes("alarm-a"), false)

  const alarmA = client.db.network_alarms.find((row) => row.id === "alarm-a")
  const alarmB = client.db.network_alarms.find((row) => row.id === "alarm-b")
  const real = client.db.network_alarms.find((row) => row.id === REAL_ALARM_ID)
  assert.equal(alarmA.deleted_at, null)
  assert.equal(alarmB.deleted_at, NOW)
  assert.equal(real.deleted_at, null)
  assert.equal(real.status, "open")

  const deviceA = client.db.network_devices.find(
    (row) => row.fingerprint === testFcmAlarmFingerprint(COMPANY_A)
  )
  const deviceB = client.db.network_devices.find(
    (row) => row.fingerprint === testFcmAlarmFingerprint(COMPANY_B)
  )
  const realDevice = client.db.network_devices.find((row) => row.id === REAL_DEVICE_ID)
  assert.equal(deviceA.deleted_at, null)
  assert.equal(deviceB.deleted_at, NOW)
  assert.equal(realDevice.deleted_at, null)
  assert.equal(realDevice.hostname, "CORE-1")
})

test("cleanup solo suaviza alarmas/dispositivo de prueba y retiene eventos inmutables", async () => {
  const client = createIsolatedClient({
    network_devices: [
      {
        id: REAL_DEVICE_ID,
        company_id: COMPANY_A,
        agent_id: AGENT_ID,
        fingerprint: "real-core",
        hostname: "CORE-1",
        management_ip: "10.0.0.1",
        origin: "discovery",
        deleted_at: null,
      },
    ],
    network_alarms: [
      {
        id: REAL_ALARM_ID,
        company_id: COMPANY_A,
        device_id: REAL_DEVICE_ID,
        severity: "critical",
        status: "open",
        title: "Core offline",
        message: "El core no responde.",
        deleted_at: null,
      },
    ],
  })

  await createTestFcmNetworkAlarm(client, COMPANY_A, {
    now: () => NOW,
    createId: () => "alarm-test-a",
    notifyOpened: async () => mockedPush(),
  })
  const createdEvents = client.db.network_alarm_events.length
  assert.equal(createdEvents, 1)

  const cleaned = await cleanupTestFcmNetworkAlarm(client, COMPANY_A, NOW)
  assert.deepEqual(cleaned.alarmIds, ["alarm-test-a"])
  assert.equal(cleaned.eventsRetained, 1)
  assert.equal(client.db.network_alarm_events.length, 1)
  assert.equal(
    client.db.network_alarms.find((row) => row.id === "alarm-test-a").deleted_at,
    NOW
  )
  assert.equal(
    client.db.network_alarms.find((row) => row.id === REAL_ALARM_ID).deleted_at,
    null
  )
  assert.equal(
    client.db.network_devices.find((row) => row.id === REAL_DEVICE_ID).deleted_at,
    null
  )
  assert.equal(
    client.db.network_devices.find(
      (row) => row.hostname === TEST_FCM_ALARM_MARKER
    ).deleted_at,
    NOW
  )
})
