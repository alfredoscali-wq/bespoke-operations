/**
 * Temporary POST /api/network/push/test — production FCM check.
 * Firebase Admin is mocked. These tests never call a live FCM project.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { createEmptyModuleVisibility } from "../lib/roles/app-modules.ts"
import {
  authorizeNetworkPushTest,
  buildNetworkPushTestContent,
  SAFE_FIREBASE_ADMIN_REASONS,
  sendNetworkPushTest,
  toNetworkPushTestResponse,
} from "../lib/network/push/send-test.ts"

const ROOT = resolve(import.meta.dirname, "..")
const COMPANY_A = "company-abnet"
const COMPANY_B = "company-other"

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function sessionUser(overrides = {}) {
  return {
    authUserId: "auth-a",
    employeeId: "emp-a",
    companyId: COMPANY_A,
    displayName: "Admin A",
    initials: "AA",
    systemRole: "administrador",
    roleId: "role-admin",
    roleCode: "administrador",
    roleName: "Administrador",
    moduleVisibility: createEmptyModuleVisibility(),
    visibleModuleKeys: ["network"],
    nationalId: null,
    mustChangePassword: false,
    email: "admin@example.com",
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

function recordingMessenger() {
  const payloads = []
  return {
    payloads,
    messenger: {
      async sendEach(messages) {
        payloads.push(...messages)
        return {
          responses: messages.map(() => ({ success: true })),
        }
      },
    },
  }
}

test("contrato: endpoint temporal protegido y sin destinatarios del body", () => {
  const route = read("app/api/network/push/test/route.ts")
  assert.match(route, /TEMPORARY TEST/)
  assert.match(route, /requireNetworkWriteContext/)
  assert.match(route, /authorizeNetworkPushTest/)
  assert.match(route, /sendNetworkPushTest/)
  assert.match(route, /gate\.companyId/)
  assert.doesNotMatch(route, /request\.json/)
  assert.doesNotMatch(route, /body\.(companyId|company_id|pushToken|user_id|device_id)/)
  assert.doesNotMatch(route, /NEXT_PUBLIC_/)
  assert.doesNotMatch(route, /network_alarms/)
  assert.doesNotMatch(route, /network_alarm_events/)
  assert.doesNotMatch(route, /persistMonitoringSnapshot|evaluateNetworkAlarm/)
  assert.doesNotMatch(route, /network_discovery_targets/)
})

test("usuario no autenticado → rechazo", () => {
  const result = authorizeNetworkPushTest(null)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.status, 401)
})

test("usuario sin acceso Network → rechazo", () => {
  const result = authorizeNetworkPushTest(
    sessionUser({
      systemRole: "operario",
      roleCode: "tecnico",
      moduleVisibility: {
        ...createEmptyModuleVisibility(),
        network: false,
      },
    })
  )
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.status, 403)
  assert.match(result.message, /Network/)
})

test("usuario no administrador → rechazo", () => {
  const result = authorizeNetworkPushTest(
    sessionUser({
      systemRole: "supervisor",
      roleCode: "supervisor",
      moduleVisibility: {
        ...createEmptyModuleVisibility(),
        network: true,
      },
    })
  )
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.status, 403)
  assert.match(result.message, /administrador/i)
})

test("aislamiento por company_id: no envía tokens de otra empresa", async () => {
  const rec = recordingMessenger()
  const result = await sendNetworkPushTest(
    {},
    COMPANY_A,
    {
      loadCandidates: async () => [
        candidate({ pushToken: "tok-a" }),
        candidate({
          companyId: COMPANY_B,
          employeeCompanyId: COMPANY_B,
          userId: "user-b",
          pushToken: "tok-b",
        }),
      ],
      resolveMessenger: () => rec.messenger,
    }
  )
  assert.equal(result.sent, 1)
  assert.equal(result.recipientCount, 1)
  assert.deepEqual(
    rec.payloads.map((message) => message.token),
    ["tok-a"]
  )
})

test("no acepta company_id arbitrario: usa solo la empresa de sesión", async () => {
  const adminA = authorizeNetworkPushTest(
    sessionUser({ companyId: COMPANY_A })
  )
  assert.equal(adminA.ok, true)
  if (!adminA.ok) return
  assert.equal(adminA.companyId, COMPANY_A)
  assert.notEqual(adminA.companyId, COMPANY_B)

  const rec = recordingMessenger()
  const spoofedBody = {
    companyId: COMPANY_B,
    pushToken: "attacker-token",
    user_id: "user-b",
    device_id: "device-b",
  }
  await sendNetworkPushTest({}, adminA.companyId, {
    loadCandidates: async (companyId) => {
      assert.equal(companyId, COMPANY_A)
      assert.notEqual(companyId, spoofedBody.companyId)
      return [
        candidate({ pushToken: "tok-a" }),
        candidate({
          companyId: COMPANY_B,
          employeeCompanyId: COMPANY_B,
          userId: spoofedBody.user_id,
          pushToken: spoofedBody.pushToken,
        }),
      ]
    },
    resolveMessenger: () => rec.messenger,
  })
  assert.deepEqual(
    rec.payloads.map((message) => message.token),
    ["tok-a"]
  )
})

test("no acepta pushToken arbitrario", async () => {
  const rec = recordingMessenger()
  await sendNetworkPushTest({}, COMPANY_A, {
    loadCandidates: async () => [candidate({ pushToken: "tok-registered" })],
    resolveMessenger: () => rec.messenger,
  })
  assert.equal(rec.payloads.length, 1)
  assert.notEqual(rec.payloads[0].token, "attacker-token")
  assert.equal(rec.payloads[0].token, "tok-registered")
})

test("payload no contiene secretos", () => {
  const content = buildNetworkPushTestContent()
  const json = JSON.stringify(content)
  assert.equal(content.data.type, "network_push_test")
  assert.equal(content.notification.title, "Bespoke — prueba FCM")
  assert.equal(
    content.notification.body,
    "Prueba de notificación push desde Producción."
  )
  assert.equal("alarmId" in content.data, false)
  assert.doesNotMatch(
    json,
    /private_key|access_token|refresh_token|BEGIN PRIVATE KEY|pushToken|push_token/i
  )
})

test("endpoint no toca network_alarms", () => {
  const route = read("app/api/network/push/test/route.ts")
  const service = read("lib/network/push/send-test.ts")
  assert.doesNotMatch(route, /network_alarms/)
  assert.doesNotMatch(service, /network_alarms/)
  assert.doesNotMatch(service, /notifyNetworkAlarmOpened/)
  assert.doesNotMatch(route, /from\("network_alarms"\)/)
})

test("respuesta segura no incluye tokens", async () => {
  const rec = recordingMessenger()
  const result = await sendNetworkPushTest({}, COMPANY_A, {
    loadCandidates: async () => [candidate()],
    resolveMessenger: () => rec.messenger,
  })
  const body = toNetworkPushTestResponse(result)
  const json = JSON.stringify(body)
  assert.equal(body.data.sent, 1)
  assert.equal(body.data.failed, 0)
  assert.equal(body.data.recipientCount, 1)
  assert.equal(body.data.outcome, "sent")
  assert.doesNotMatch(json, /tok-a-device-1|pushToken|push_token/)
})

test("respuesta incluye outcome y nunca secretos", async () => {
  const result = await sendNetworkPushTest({}, COMPANY_A, {
    loadCandidates: async () => [candidate()],
    resolveMessenger: () => null,
  })
  const body = toNetworkPushTestResponse(result)
  const json = JSON.stringify(body)
  assert.equal(body.data.recipientCount, 1)
  assert.equal(body.data.sent, 0)
  assert.equal(body.data.failed, 0)
  assert.equal(body.data.outcome, "firebase_unconfigured")
  if (body.data.reason) {
    assert.equal(SAFE_FIREBASE_ADMIN_REASONS.includes(body.data.reason), true)
  }
  assert.doesNotMatch(
    json,
    /private_key|client_email|BEGIN PRIVATE KEY|access_token|refresh_token|pushToken|FIREBASE_SERVICE_ACCOUNT_JSON/i
  )
  const service = read("lib/network/push/send-test.ts")
  assert.match(service, /outcome: result\.outcome/)
  assert.doesNotMatch(service, /private_key|client_email|pushToken/)
})
