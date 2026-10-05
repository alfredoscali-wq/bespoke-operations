/**
 * Network Mobile Push 2.0 — FCM send on newly opened alarms.
 * Firebase Admin is mocked. These tests never call a live FCM project.
 */
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { applyNetworkAlarmActions } from "../lib/network/alarms/queries.ts"
import {
  parseFirebaseServiceAccountJson,
  EXPECTED_FIREBASE_PROJECT_ID,
  FIREBASE_SERVICE_ACCOUNT_ENV,
} from "../lib/firebase/service-account.ts"
import { dispatchNetworkAlarmPush } from "../lib/network/push/dispatch.ts"
import {
  fetchNetworkAlarmPushCandidates,
  mapNetworkAlarmPushCandidates,
} from "../lib/network/push/fetch-recipients.ts"
import { buildNetworkAlarmPushPayload } from "../lib/network/push/payload.ts"
import { selectNetworkAlarmPushRecipients } from "../lib/network/push/recipients.ts"
import { notifyNetworkAlarmOpened } from "../lib/network/push/send-alarm.ts"

const ROOT = resolve(import.meta.dirname, "..")
const COMPANY_A = "company-abnet"
const COMPANY_B = "company-other"
const NOW = "2026-10-05T18:00:00.000Z"

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function alarmRecord(overrides = {}) {
  return {
    id: "alarm-a-1",
    companyId: COMPANY_A,
    deviceId: "device-1",
    severity: "critical",
    status: "open",
    title: "Core offline",
    message: "El core TEST-CORE no responde.",
    rootAlarmId: null,
    isRoot: true,
    createdAt: NOW,
    seenAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    ...overrides,
  }
}

function candidate(overrides = {}) {
  return {
    companyId: COMPANY_A,
    userId: "user-a",
    pushToken: "tok-a-device-1",
    enabled: true,
    deletedAt: null,
    employeeCompanyId: COMPANY_A,
    employeeDeletedAt: null,
    systemRole: "operario",
    roleCode: "tecnico",
    moduleVisibility: { network: true },
    ...overrides,
  }
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
    network_alarms: [],
    network_alarm_events: [],
    network_push_tokens: [],
    employees: [],
    company_roles: [],
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
              return { data: null, error: { code: "23505", message: "duplicate key" } }
            }
          }
        }
        const inserted = {
          deleted_at: null,
          id: state.row.id ?? `row-${seq++}`,
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

function recordingMessenger(responses) {
  const sentTokens = []
  const payloads = []
  return {
    sentTokens,
    payloads,
    messenger: {
      async sendEach(messages) {
        for (const message of messages) {
          sentTokens.push(message.token)
          payloads.push(message)
        }
        return {
          responses: messages.map((_, index) => responses[index] ?? { success: true }),
        }
      },
    },
  }
}

function fakeServiceAccountJson(overrides = {}) {
  return JSON.stringify({
    type: "service_account",
    project_id: EXPECTED_FIREBASE_PROJECT_ID,
    client_email: "sa@bespoke-cb1b0.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nFAKEKEY\\n-----END PRIVATE KEY-----\\n",
    ...overrides,
  })
}

test("contrato: Firebase Admin usa FIREBASE_SERVICE_ACCOUNT_JSON y no secretos públicos", () => {
  const admin = read("lib/firebase/admin.ts")
  const serviceAccount = read("lib/firebase/service-account.ts")
  const send = read("lib/network/push/send-alarm.ts")
  const queries = read("lib/network/alarms/queries.ts")
  const evaluate = read("lib/network/alarms/evaluate.ts")
  assert.match(admin, /FIREBASE_SERVICE_ACCOUNT_JSON/)
  assert.match(serviceAccount, /FIREBASE_SERVICE_ACCOUNT_ENV/)
  assert.equal(FIREBASE_SERVICE_ACCOUNT_ENV, "FIREBASE_SERVICE_ACCOUNT_JSON")
  assert.doesNotMatch(admin, /NEXT_PUBLIC_/)
  assert.doesNotMatch(serviceAccount, /NEXT_PUBLIC_/)
  assert.doesNotMatch(send, /NEXT_PUBLIC_/)
  assert.doesNotMatch(queries, /network_push_tokens/)
  assert.match(queries, /notifyNetworkAlarmOpened/)
  assert.match(queries, /isUniqueViolation\(error\)\) continue/)
  assert.doesNotMatch(evaluate, /notifyNetworkAlarmOpened|firebase-admin/)
  assert.doesNotMatch(send, /console\.(log|info|debug|warn|error)[\s\S]{0,80}pushToken/)
  assert.doesNotMatch(send, /console\.(log|info|debug|warn|error)[\s\S]{0,80}private_key/)
})

test("Firebase Admin parsea project_id, client_email y private_key", () => {
  const parsed = parseFirebaseServiceAccountJson(fakeServiceAccountJson())
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.credential.projectId, EXPECTED_FIREBASE_PROJECT_ID)
  assert.equal(parsed.credential.clientEmail, "sa@bespoke-cb1b0.iam.gserviceaccount.com")
  assert.match(parsed.credential.privateKey, /BEGIN PRIVATE KEY/)
  assert.equal(parseFirebaseServiceAccountJson(undefined).ok, false)
  assert.equal(parseFirebaseServiceAccountJson("").reason, "missing")
  assert.equal(parseFirebaseServiceAccountJson("{not-json").reason, "invalid_json")
  assert.equal(
    parseFirebaseServiceAccountJson(
      fakeServiceAccountJson({ project_id: "other-project" })
    ).reason,
    "project_mismatch"
  )
  assert.equal(
    parseFirebaseServiceAccountJson(
      JSON.stringify({ project_id: EXPECTED_FIREBASE_PROJECT_ID })
    ).reason,
    "invalid_fields"
  )
})

test("1: alarma de empresa A → solamente tokens de A", () => {
  const recipients = selectNetworkAlarmPushRecipients(COMPANY_A, [
    candidate({ pushToken: "tok-a" }),
    candidate({
      companyId: COMPANY_B,
      employeeCompanyId: COMPANY_B,
      userId: "user-b",
      pushToken: "tok-b",
    }),
  ])
  assert.deepEqual(
    recipients.map((row) => row.pushToken),
    ["tok-a"]
  )
})

test("2: alarma de empresa B → solamente tokens de B", () => {
  const recipients = selectNetworkAlarmPushRecipients(COMPANY_B, [
    candidate({ pushToken: "tok-a" }),
    candidate({
      companyId: COMPANY_B,
      employeeCompanyId: COMPANY_B,
      userId: "user-b",
      pushToken: "tok-b",
    }),
  ])
  assert.deepEqual(
    recipients.map((row) => row.pushToken),
    ["tok-b"]
  )
})

test("3: token enabled = false → no recibe", () => {
  const recipients = selectNetworkAlarmPushRecipients(COMPANY_A, [
    candidate({ enabled: false, pushToken: "tok-disabled" }),
  ])
  assert.equal(recipients.length, 0)
})

test("4: deleted_at no null → no recibe", () => {
  const recipients = selectNetworkAlarmPushRecipients(COMPANY_A, [
    candidate({ deletedAt: NOW, pushToken: "tok-deleted" }),
  ])
  assert.equal(recipients.length, 0)
})

test("5: usuario sin acceso a Network → no recibe", () => {
  const recipients = selectNetworkAlarmPushRecipients(COMPANY_A, [
    candidate({
      systemRole: "operario",
      roleCode: "tecnico",
      moduleVisibility: { network: false },
      pushToken: "tok-no-network",
    }),
  ])
  assert.equal(recipients.length, 0)
})

test("6: usuario con acceso Network → recibe", () => {
  const withFlag = selectNetworkAlarmPushRecipients(COMPANY_A, [
    candidate({ moduleVisibility: { network: true }, pushToken: "tok-flag" }),
  ])
  const admin = selectNetworkAlarmPushRecipients(COMPANY_A, [
    candidate({
      systemRole: "administrador",
      roleCode: "administrador",
      moduleVisibility: { network: false },
      pushToken: "tok-admin",
    }),
  ])
  assert.deepEqual(
    withFlag.map((row) => row.pushToken),
    ["tok-flag"]
  )
  assert.deepEqual(
    admin.map((row) => row.pushToken),
    ["tok-admin"]
  )
})

test("7: varios dispositivos → reciben", async () => {
  const rec = recordingMessenger([{ success: true }, { success: true }])
  const result = await dispatchNetworkAlarmPush(
    [
      { userId: "user-a", pushToken: "tok-phone" },
      { userId: "user-a", pushToken: "tok-tablet" },
    ],
    buildNetworkAlarmPushPayload(alarmRecord()),
    rec.messenger
  )
  assert.deepEqual(rec.sentTokens, ["tok-phone", "tok-tablet"])
  assert.equal(result.sent, 2)
  assert.equal(result.recipientCount, 2)
})

test("8: mismo token duplicado → no se envía dos veces", async () => {
  const recipients = selectNetworkAlarmPushRecipients(COMPANY_A, [
    candidate({ userId: "user-a", pushToken: "tok-dup" }),
    candidate({ userId: "user-b", pushToken: "tok-dup" }),
  ])
  assert.equal(recipients.length, 1)
  const rec = recordingMessenger([{ success: true }, { success: true }])
  await dispatchNetworkAlarmPush(
    recipients,
    buildNetworkAlarmPushPayload(alarmRecord()),
    rec.messenger
  )
  assert.deepEqual(rec.sentTokens, ["tok-dup"])
})

test("9-11: payload contiene alarmId y companyId y no contiene secretos", async () => {
  const payload = buildNetworkAlarmPushPayload(
    alarmRecord({ id: "alarm-secret-check", companyId: COMPANY_A })
  )
  const json = JSON.stringify(payload)
  assert.equal(payload.type, "network_alarm")
  assert.equal(payload.alarmId, "alarm-secret-check")
  assert.equal(payload.companyId, COMPANY_A)
  assert.equal("pushToken" in payload, false)
  assert.equal("token" in payload, false)
  assert.doesNotMatch(
    json,
    /private_key|access_token|refresh_token|BEGIN PRIVATE KEY|fcm-token/i
  )

  const rec = recordingMessenger([{ success: true }])
  await dispatchNetworkAlarmPush(
    [{ userId: "user-a", pushToken: "secret-should-not-be-in-data" }],
    payload,
    rec.messenger
  )
  const dataJson = JSON.stringify(rec.payloads[0].data)
  assert.equal(rec.payloads[0].data.alarmId, "alarm-secret-check")
  assert.equal(rec.payloads[0].data.companyId, COMPANY_A)
  assert.doesNotMatch(dataJson, /secret-should-not-be-in-data/)
  assert.equal(rec.payloads[0].notification.title, payload.title)
  assert.equal(rec.payloads[0].notification.body, payload.message)
})

test("12: alarma nueva → se intenta enviar", async () => {
  const client = createIsolatedClient()
  const calls = []
  const alarm = alarmRecord({ id: randomUUID(), deviceId: "dev-new" })
  await applyNetworkAlarmActions(
    client,
    [{ type: "open", alarm }],
    async (_client, opened) => {
      calls.push(opened.id)
    }
  )
  assert.equal(client.db.network_alarms.length, 1)
  assert.deepEqual(calls, [alarm.id])
})

test("13: alarma existente/no creada nuevamente → no se intenta enviar", async () => {
  const client = createIsolatedClient()
  const calls = []
  const alarm = alarmRecord({ id: randomUUID(), deviceId: "dev-dup" })
  const notify = async (_client, opened) => {
    calls.push(opened.id)
  }
  await applyNetworkAlarmActions(client, [{ type: "open", alarm }], notify)
  await applyNetworkAlarmActions(
    client,
    [{ type: "open", alarm: { ...alarm, id: randomUUID() } }],
    notify
  )
  assert.equal(client.db.network_alarms.length, 1)
  assert.equal(calls.length, 1)
})

test("14: fallo de un token → continúa con los demás", async () => {
  const rec = recordingMessenger([
    { success: false, errorCode: "messaging/internal-error" },
    { success: true },
  ])
  const result = await dispatchNetworkAlarmPush(
    [
      { userId: "user-a", pushToken: "tok-fail" },
      { userId: "user-b", pushToken: "tok-ok" },
    ],
    buildNetworkAlarmPushPayload(alarmRecord()),
    rec.messenger
  )
  assert.deepEqual(rec.sentTokens, ["tok-fail", "tok-ok"])
  assert.equal(result.sent, 1)
  assert.equal(result.failed, 1)
  assert.equal(result.invalidTokens, 0)
})

test("15: Firebase no configurado → alarma no falla", async () => {
  const client = createIsolatedClient()
  const alarm = alarmRecord({ id: randomUUID(), deviceId: "dev-unconfigured" })
  await applyNetworkAlarmActions(client, [{ type: "open", alarm }], async () =>
    notifyNetworkAlarmOpened(client, alarm, {
      loadCandidates: async () => [candidate()],
      resolveMessenger: () => null,
    })
  )
  assert.equal(client.db.network_alarms.length, 1)
  const result = await notifyNetworkAlarmOpened(client, alarm, {
    loadCandidates: async () => [candidate()],
    resolveMessenger: () => null,
  })
  assert.equal(result.outcome, "firebase_unconfigured")
  assert.equal(result.attempted, false)
})

test("16: Firebase devuelve error global → alarma no falla", async () => {
  const client = createIsolatedClient()
  const alarm = alarmRecord({ id: randomUUID(), deviceId: "dev-global-fail" })
  await applyNetworkAlarmActions(client, [{ type: "open", alarm }], async () =>
    notifyNetworkAlarmOpened(client, alarm, {
      loadCandidates: async () => [candidate()],
      resolveMessenger: () => ({
        async sendEach() {
          throw new Error("FCM unavailable")
        },
      }),
    })
  )
  assert.equal(client.db.network_alarms.length, 1)
  const result = await notifyNetworkAlarmOpened(client, alarm, {
    loadCandidates: async () => [candidate()],
    resolveMessenger: () => ({
      async sendEach() {
        throw new Error("FCM unavailable")
      },
    }),
  })
  assert.equal(result.outcome, "firebase_unavailable")
  assert.equal(result.failed, 1)
})

test("17: no existen tokens → alarma no falla", async () => {
  const client = createIsolatedClient()
  const alarm = alarmRecord({ id: randomUUID(), deviceId: "dev-no-tokens" })
  let messengerCalls = 0
  await applyNetworkAlarmActions(client, [{ type: "open", alarm }], async () =>
    notifyNetworkAlarmOpened(client, alarm, {
      loadCandidates: async () => [],
      resolveMessenger: () => {
        messengerCalls += 1
        return recordingMessenger([]).messenger
      },
    })
  )
  assert.equal(client.db.network_alarms.length, 1)
  assert.equal(messengerCalls, 0)
})

test("multi-tenant: fetch no mezcla empresas ni tokens inactivos", async () => {
  const roleA = {
    id: "role-a",
    company_id: COMPANY_A,
    code: "tecnico",
    module_visibility: { network: true },
  }
  const roleB = {
    id: "role-b",
    company_id: COMPANY_B,
    code: "tecnico",
    module_visibility: { network: true },
  }
  const client = createIsolatedClient({
    company_roles: [roleA, roleB],
    employees: [
      {
        id: "user-a",
        company_id: COMPANY_A,
        system_role: "operario",
        role_id: "role-a",
        deleted_at: null,
      },
      {
        id: "user-b",
        company_id: COMPANY_B,
        system_role: "operario",
        role_id: "role-b",
        deleted_at: null,
      },
      {
        id: "user-disabled",
        company_id: COMPANY_A,
        system_role: "operario",
        role_id: "role-a",
        deleted_at: null,
      },
    ],
    network_push_tokens: [
      {
        company_id: COMPANY_A,
        user_id: "user-a",
        push_token: "tok-a",
        enabled: true,
        deleted_at: null,
      },
      {
        company_id: COMPANY_B,
        user_id: "user-b",
        push_token: "tok-b",
        enabled: true,
        deleted_at: null,
      },
      {
        company_id: COMPANY_A,
        user_id: "user-disabled",
        push_token: "tok-disabled",
        enabled: false,
        deleted_at: null,
      },
      {
        company_id: COMPANY_A,
        user_id: "user-a",
        push_token: "tok-deleted",
        enabled: true,
        deleted_at: NOW,
      },
    ],
  })

  const candidatesA = await fetchNetworkAlarmPushCandidates(client, COMPANY_A)
  const recipientsA = selectNetworkAlarmPushRecipients(COMPANY_A, candidatesA)
  assert.deepEqual(
    recipientsA.map((row) => row.pushToken),
    ["tok-a"]
  )

  const candidatesB = await fetchNetworkAlarmPushCandidates(client, COMPANY_B)
  const recipientsB = selectNetworkAlarmPushRecipients(COMPANY_B, candidatesB)
  assert.deepEqual(
    recipientsB.map((row) => row.pushToken),
    ["tok-b"]
  )
})

test("map candidatos conserva company_id del token y del empleado", () => {
  const mapped = mapNetworkAlarmPushCandidates({
    tokens: [
      {
        company_id: COMPANY_A,
        user_id: "user-a",
        push_token: "tok-a",
        enabled: true,
        deleted_at: null,
      },
    ],
    employees: [
      {
        id: "user-a",
        company_id: COMPANY_B,
        system_role: "administrador",
        role_id: null,
        deleted_at: null,
      },
    ],
    roles: [],
  })
  const recipients = selectNetworkAlarmPushRecipients(COMPANY_A, mapped)
  assert.equal(recipients.length, 0)
})

test("token inválido inequívoco se cuenta y no se limpia en este sprint", async () => {
  const dispatch = read("lib/network/push/dispatch.ts")
  const send = read("lib/network/push/send-alarm.ts")
  assert.match(dispatch, /invalid-registration-token/)
  assert.doesNotMatch(send, /deleted_at/)
  const result = await dispatchNetworkAlarmPush(
    [{ userId: "user-a", pushToken: "tok-invalid" }],
    buildNetworkAlarmPushPayload(alarmRecord()),
    recordingMessenger([
      { success: false, errorCode: "messaging/registration-token-not-registered" },
    ]).messenger
  )
  assert.equal(result.invalidTokens, 1)
  assert.equal(result.failed, 1)
})
