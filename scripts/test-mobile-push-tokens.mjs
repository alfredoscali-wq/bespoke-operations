/**
 * Mobile Push 1.0 — POST /api/mobile/v1/push-tokens
 * Source-contract + in-memory registration. Does not hit a live database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { applyPushTokenRegistration } from "../lib/mobile/v1/push/apply-push-token-registration.ts"
import { publicPushTokenRegistrationResult } from "../lib/mobile/v1/push/apply-push-token-registration.ts"
import { validateMobilePushTokenRequest } from "../lib/mobile/v1/push/validate-push-token-request.ts"
import { MobileApiError } from "../lib/mobile/v1/errors.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const route = read("app/api/mobile/v1/push-tokens/route.ts")
const service = read("lib/mobile/v1/push/register-push-token-service.ts")
const validate = read("lib/mobile/v1/push/validate-push-token-request.ts")
const apply = read("lib/mobile/v1/push/apply-push-token-registration.ts")
const queries = read("lib/mobile/v1/push/push-token-queries.ts")
const docs = read("docs/mobile-api.md")
const errors = read("lib/mobile/v1/errors.ts")

const FAKE_TOKEN = "fake-fcm-token-aaaa"
const FAKE_TOKEN_NEXT = "fake-fcm-token-bbbb"

function sampleRow(overrides = {}) {
  return {
    id: "row-1",
    company_id: "company-1",
    user_id: "employee-1",
    device_id: "device-1",
    platform: "android",
    push_token: FAKE_TOKEN,
    enabled: true,
    last_seen_at: "2026-10-04T20:00:00.000Z",
    created_at: "2026-10-04T20:00:00.000Z",
    updated_at: "2026-10-04T20:00:00.000Z",
    deleted_at: null,
    ...overrides,
  }
}

test("contrato: ruta protegida y body sin identidad del cliente", () => {
  assert.match(route, /handleProtectedMobileRoute/)
  assert.match(route, /validateMobilePushTokenRequest/)
  assert.match(route, /registerMobilePushToken/)
  assert.doesNotMatch(validate, /userId/)
  assert.doesNotMatch(validate, /companyId/)
  assert.match(service, /auth\.companyId/)
  assert.match(service, /auth\.employeeId/)
})

test("contrato: platform android y deviceId del mecanismo mobile_devices", () => {
  assert.match(validate, /platform debe ser android/)
  assert.match(service, /fetchMobileDeviceByCompanyAndDeviceId/)
  assert.match(service, /DEVICE_NOT_FOUND/)
  assert.match(service, /DEVICE_BLOCKED/)
  assert.match(queries, /from\("network_push_tokens"\)/)
  assert.match(queries, /\.eq\("company_id", companyId\)/)
})

test("contrato: respuesta no incluye el token", () => {
  const result = publicPushTokenRegistrationResult()
  const serialized = JSON.stringify(result)
  assert.equal(result.registered, true)
  assert.equal(serialized.includes("push_token"), false)
  assert.equal(serialized.includes("pushToken"), false)
  assert.doesNotMatch(route, /pushToken/)
  assert.match(docs, /The response never includes `pushToken`/)
  assert.doesNotMatch(docs, /"registered": true[\s\S]{0,80}pushToken/)
})

test("contrato: no loguea el token", () => {
  assert.doesNotMatch(service, /console\.(log|info|debug|warn|error).*pushToken/)
  assert.doesNotMatch(queries, /console\.(log|info|debug|warn|error)/)
  assert.doesNotMatch(apply, /console\./)
})

test("validate: token válido", () => {
  const request = validateMobilePushTokenRequest({
    deviceId: " device-1 ",
    pushToken: ` ${FAKE_TOKEN} `,
    platform: "android",
    userId: "should-be-ignored",
    companyId: "should-be-ignored",
  })
  assert.deepEqual(request, {
    deviceId: "device-1",
    pushToken: FAKE_TOKEN,
    platform: "android",
  })
})

test("validate: platform inválida", () => {
  assert.throws(
    () =>
      validateMobilePushTokenRequest({
        deviceId: "device-1",
        pushToken: FAKE_TOKEN,
        platform: "ios",
      }),
    (error) =>
      error instanceof MobileApiError && error.code === "INVALID_REQUEST"
  )
})

test("registro: primer token crea un único activo", () => {
  const next = applyPushTokenRegistration([], {
    companyId: "company-1",
    employeeId: "employee-1",
    deviceId: "device-1",
    platform: "android",
    pushToken: FAKE_TOKEN,
    now: "2026-10-04T21:00:00.000Z",
    newId: "row-new",
  })

  assert.equal(next.length, 1)
  assert.equal(next[0].user_id, "employee-1")
  assert.equal(next[0].device_id, "device-1")
  assert.equal(next[0].platform, "android")
  assert.equal(next[0].enabled, true)
  assert.equal(next[0].last_seen_at, "2026-10-04T21:00:00.000Z")
})

test("registro: mismo dispositivo/token no duplica", () => {
  const existing = [sampleRow()]
  const next = applyPushTokenRegistration(existing, {
    companyId: "company-1",
    employeeId: "employee-1",
    deviceId: "device-1",
    platform: "android",
    pushToken: FAKE_TOKEN,
    now: "2026-10-04T21:05:00.000Z",
    newId: "row-new",
  })

  const active = next.filter((row) => row.deleted_at == null)
  assert.equal(active.length, 1)
  assert.equal(active[0].id, "row-1")
  assert.equal(active[0].last_seen_at, "2026-10-04T21:05:00.000Z")
})

test("registro: nuevo token actualiza el mismo device", () => {
  const next = applyPushTokenRegistration([sampleRow()], {
    companyId: "company-1",
    employeeId: "employee-1",
    deviceId: "device-1",
    platform: "android",
    pushToken: FAKE_TOKEN_NEXT,
    now: "2026-10-04T21:10:00.000Z",
    newId: "row-new",
  })

  const active = next.filter((row) => row.deleted_at == null)
  assert.equal(active.length, 1)
  assert.equal(active[0].push_token, FAKE_TOKEN_NEXT)
  assert.equal(active[0].enabled, true)
})

test("registro: token reutilizado desactiva el registro anterior", () => {
  const existing = [
    sampleRow({ id: "row-old", device_id: "device-old", user_id: "employee-2" }),
  ]
  const next = applyPushTokenRegistration(existing, {
    companyId: "company-1",
    employeeId: "employee-1",
    deviceId: "device-1",
    platform: "android",
    pushToken: FAKE_TOKEN,
    now: "2026-10-04T21:15:00.000Z",
    newId: "row-new",
  })

  const oldRow = next.find((row) => row.id === "row-old")
  const created = next.find((row) => row.id === "row-new")
  assert.equal(oldRow.deleted_at, "2026-10-04T21:15:00.000Z")
  assert.equal(oldRow.enabled, false)
  assert.equal(created.enabled, true)
  assert.equal(created.device_id, "device-1")
})

test("identidad: user_id persistido es employees.id", () => {
  assert.match(service, /employeeId: auth\.employeeId/)
  assert.doesNotMatch(service, /auth\.authUserId/)
  assert.match(apply, /user_id: input\.employeeId/)
  assert.match(queries, /user_id: row\.user_id/)
})
