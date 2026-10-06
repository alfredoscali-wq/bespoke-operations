/**
 * Alarmas 1.1 — per-employee FCM notification audit.
 * Firebase is mocked. These tests never send a live FCM message.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { dispatchNetworkAlarmPush } from "../lib/network/push/dispatch.ts"
import { notifyNetworkAlarmOpened } from "../lib/network/push/send-alarm.ts"
import { buildNetworkAlarmPushPayload } from "../lib/network/push/payload.ts"
import {
  markNetworkAlarmNotificationOpened,
  persistNetworkAlarmNotificationSends,
  sanitizeNotificationErrorCode,
  summarizeEmployeeNotificationOutcomes,
} from "../lib/network/push/persist-notifications.ts"

const ROOT = resolve(import.meta.dirname, "..")
const COMPANY_A = "company-abnet"
const COMPANY_B = "company-other"
const ALARM_ID = "alarm-notify-1"
const EMPLOYEE_A = "emp-a"
const EMPLOYEE_B = "emp-b"
const NOW = "2026-10-05T23:00:00.000Z"
const OPENED_AT = "2026-10-05T23:01:00.000Z"
const LATER = "2026-10-05T23:02:00.000Z"

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
    network_alarm_notifications: [],
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
      is(col, val) {
        state.filters.push({ op: "is", col, val })
        return chain
      },
      in(col, val) {
        state.filters.push({ op: "in", col, val })
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
        const inserted = {
          id: state.row.id ?? `notif-${seq++}`,
          opened_at: null,
          device_id: null,
          ...state.row,
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

function alarm() {
  return {
    id: ALARM_ID,
    companyId: COMPANY_A,
    severity: "critical",
    title: "Core offline",
    message: "El core no responde.",
  }
}

test("contrato: tabla de auditoría no guarda tokens ni mezcla WIP de events", () => {
  const migration = read(
    "supabase/migrations/20261231000500_network_alarm_notifications.sql"
  )
  const persist = read("lib/network/push/persist-notifications.ts")
  const send = read("lib/network/push/send-alarm.ts")
  const route = read(
    "app/api/mobile/v1/alarms/[alarmId]/notification-opened/route.ts"
  )
  const types = read("lib/supabase/database.types.ts")

  assert.match(migration, /CREATE TABLE public.network_alarm_notifications/)
  assert.match(migration, /send_outcome IN \('sent', 'failed', 'not_attempted'\)/)
  assert.match(migration, /UNIQUE INDEX network_alarm_notifications_alarm_employee_idx/)
  assert.match(migration, /GRANT SELECT ON public.network_alarm_notifications/)
  assert.doesNotMatch(migration, /GRANT SELECT, INSERT, UPDATE/)
  assert.doesNotMatch(migration, /push_token\s/)
  assert.doesNotMatch(migration, /REFERENCES public\.network_push_tokens/)
  assert.doesNotMatch(migration, /REFERENCES public\.network_alarm_events/)

  assert.match(persist, /persistNetworkAlarmNotificationSends/)
  assert.doesNotMatch(persist, /pushToken\s*:/)
  assert.doesNotMatch(persist, /from\("network_push_tokens"\)/)
  assert.match(send, /persistNetworkAlarmNotificationSends/)
  assert.match(send, /Failed to persist alarm notifications/)
  assert.doesNotMatch(send, /selectNetworkAlarmPushRecipients[\s\S]{0,80}filter/)

  assert.match(route, /handleProtectedMobileRoute/)
  assert.match(route, /auth\.companyId/)
  assert.match(route, /auth\.employeeId/)
  assert.match(route, /Ignore any body fields|companyId/)
  assert.doesNotMatch(route, /body\.companyId|body\.employeeId/)
  assert.match(types, /network_alarm_notifications:/)
})

test("1: crea fila por destinatario", async () => {
  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: [{ employeeId: EMPLOYEE_A, success: true, errorCode: null }],
  })
  assert.equal(client.db.network_alarm_notifications.length, 1)
  assert.equal(client.db.network_alarm_notifications[0].employee_id, EMPLOYEE_A)
  assert.equal(client.db.network_alarm_notifications[0].alarm_id, ALARM_ID)
  assert.equal(client.db.network_alarm_notifications[0].company_id, COMPANY_A)
})

test("2: éxito en un dispositivo → sent", async () => {
  const summaries = summarizeEmployeeNotificationOutcomes(
    [{ employeeId: EMPLOYEE_A, success: true, errorCode: null }],
    { mode: "dispatched", now: NOW }
  )
  assert.equal(summaries.length, 1)
  assert.equal(summaries[0].sendOutcome, "sent")
  assert.equal(summaries[0].sentAt, NOW)
  assert.equal(summaries[0].attemptedAt, NOW)
  assert.equal(summaries[0].errorCode, null)
})

test("3: múltiples dispositivos del mismo empleado, uno exitoso → sent", async () => {
  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: [
      { employeeId: EMPLOYEE_A, success: false, errorCode: "messaging/internal-error" },
      { employeeId: EMPLOYEE_A, success: true, errorCode: null },
    ],
  })
  assert.equal(client.db.network_alarm_notifications.length, 1)
  assert.equal(client.db.network_alarm_notifications[0].send_outcome, "sent")
  assert.equal(client.db.network_alarm_notifications[0].error_code, null)
  assert.equal(client.db.network_alarm_notifications[0].sent_at, NOW)
})

test("4: múltiples dispositivos, todos fallan → failed", async () => {
  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: [
      { employeeId: EMPLOYEE_A, success: false, errorCode: "messaging/internal-error" },
      { employeeId: EMPLOYEE_A, success: false, errorCode: "messaging/unavailable" },
    ],
  })
  assert.equal(client.db.network_alarm_notifications.length, 1)
  assert.equal(client.db.network_alarm_notifications[0].send_outcome, "failed")
  assert.equal(client.db.network_alarm_notifications[0].sent_at, null)
  assert.equal(
    client.db.network_alarm_notifications[0].error_code,
    "messaging/internal-error"
  )
})

test("5: Firebase no configurado → not_attempted", async () => {
  const client = createIsolatedClient()
  const result = await notifyNetworkAlarmOpened(client, alarm(), {
    loadCandidates: async () => [
      {
        companyId: COMPANY_A,
        userId: EMPLOYEE_A,
        pushToken: "tok-a",
        enabled: true,
        deletedAt: null,
        employeeCompanyId: COMPANY_A,
        employeeDeletedAt: null,
        systemRole: "operario",
        roleCode: "tecnico",
        moduleVisibility: { network: true },
      },
    ],
    resolveMessenger: () => null,
  })
  assert.equal(result.outcome, "firebase_unconfigured")
  assert.equal(client.db.network_alarm_notifications.length, 1)
  assert.equal(client.db.network_alarm_notifications[0].send_outcome, "not_attempted")
  assert.equal(client.db.network_alarm_notifications[0].attempted_at, null)
  assert.equal(client.db.network_alarm_notifications[0].sent_at, null)
})

test("6: error FCM conserva error_code sin token", async () => {
  const rec = {
    async sendEach() {
      return {
        responses: [
          { success: false, errorCode: "messaging/internal-error" },
        ],
      }
    },
  }
  const dispatched = await dispatchNetworkAlarmPush(
    [{ userId: EMPLOYEE_A, pushToken: "secret-token-must-not-persist" }],
    buildNetworkAlarmPushPayload(alarm()),
    rec
  )
  assert.equal(dispatched.results[0].errorCode, "messaging/internal-error")
  assert.equal("pushToken" in dispatched.results[0], false)
  assert.equal(
    sanitizeNotificationErrorCode("secret-token-must-not-persist token leak"),
    "send_failed"
  )

  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: dispatched.results.map((item) => ({
      employeeId: item.userId,
      success: item.success,
      errorCode: item.errorCode,
    })),
  })
  const json = JSON.stringify(client.db.network_alarm_notifications)
  assert.doesNotMatch(json, /secret-token-must-not-persist/)
  assert.equal(client.db.network_alarm_notifications[0].error_code, "messaging/internal-error")
})

test("7: sin destinatarios → no crea filas", async () => {
  const client = createIsolatedClient()
  const result = await notifyNetworkAlarmOpened(client, alarm(), {
    loadCandidates: async () => [],
    resolveMessenger: () => {
      throw new Error("no debe llamarse al messenger")
    },
  })
  assert.equal(result.outcome, "no_recipients")
  assert.equal(client.db.network_alarm_notifications.length, 0)
})

test("8: notification-opened del destinatario → opened_at", async () => {
  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: [{ employeeId: EMPLOYEE_A, success: true, errorCode: null }],
  })
  const opened = await markNetworkAlarmNotificationOpened(client, {
    companyId: COMPANY_A,
    employeeId: EMPLOYEE_A,
    alarmId: ALARM_ID,
    now: OPENED_AT,
  })
  assert.equal(opened.openedAt, OPENED_AT)
  assert.equal(client.db.network_alarm_notifications[0].opened_at, OPENED_AT)
})

test("9: segundo notification-opened no cambia el primer opened_at", async () => {
  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: [{ employeeId: EMPLOYEE_A, success: true, errorCode: null }],
  })
  await markNetworkAlarmNotificationOpened(client, {
    companyId: COMPANY_A,
    employeeId: EMPLOYEE_A,
    alarmId: ALARM_ID,
    now: OPENED_AT,
  })
  const second = await markNetworkAlarmNotificationOpened(client, {
    companyId: COMPANY_A,
    employeeId: EMPLOYEE_A,
    alarmId: ALARM_ID,
    now: LATER,
  })
  assert.equal(second.openedAt, OPENED_AT)
  assert.equal(client.db.network_alarm_notifications[0].opened_at, OPENED_AT)
})

test("10: usuario de otro tenant → 404", async () => {
  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: [{ employeeId: EMPLOYEE_A, success: true, errorCode: null }],
  })
  const opened = await markNetworkAlarmNotificationOpened(client, {
    companyId: COMPANY_B,
    employeeId: EMPLOYEE_A,
    alarmId: ALARM_ID,
    now: OPENED_AT,
  })
  assert.equal(opened, null)
})

test("11: usuario que no fue destinatario → 404", async () => {
  const client = createIsolatedClient()
  await persistNetworkAlarmNotificationSends(client, {
    companyId: COMPANY_A,
    alarmId: ALARM_ID,
    mode: "dispatched",
    now: NOW,
    results: [{ employeeId: EMPLOYEE_A, success: true, errorCode: null }],
  })
  const opened = await markNetworkAlarmNotificationOpened(client, {
    companyId: COMPANY_A,
    employeeId: EMPLOYEE_B,
    alarmId: ALARM_ID,
    now: OPENED_AT,
  })
  assert.equal(opened, null)
})

test("12: body intentando falsificar companyId/employeeId no funciona", () => {
  const route = read(
    "app/api/mobile/v1/alarms/[alarmId]/notification-opened/route.ts"
  )
  assert.match(route, /void \(await request\.json\(\)\.catch/)
  assert.match(route, /companyId: auth\.companyId/)
  assert.match(route, /employeeId: auth\.employeeId/)
  assert.doesNotMatch(route, /body\.companyId|requestedCompanyId|body\.employeeId/)
})

test("persistencia fallida no cambia el resultado FCM", async () => {
  const client = {
    from() {
      throw new Error("db down")
    },
  }
  const rec = {
    async sendEach() {
      return { responses: [{ success: true }] }
    },
  }
  const result = await notifyNetworkAlarmOpened(client, alarm(), {
    loadCandidates: async () => [
      {
        companyId: COMPANY_A,
        userId: EMPLOYEE_A,
        pushToken: "tok-a",
        enabled: true,
        deletedAt: null,
        employeeCompanyId: COMPANY_A,
        employeeDeletedAt: null,
        systemRole: "operario",
        roleCode: "tecnico",
        moduleVisibility: { network: true },
      },
    ],
    resolveMessenger: () => rec,
  })
  assert.equal(result.outcome, "sent")
  assert.equal(result.sent, 1)
})
