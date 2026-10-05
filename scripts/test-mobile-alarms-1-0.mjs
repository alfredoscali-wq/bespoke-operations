/**
 * Mobile Alarms API 1.0 — GET /api/mobile/v1/alarms
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  assertCanReadMobileNetworkAlarms,
  canReadMobileNetworkAlarms,
  resolveMobileNetworkAlarmsCompanyId,
} from "../lib/mobile/v1/alarms/can-read-mobile-network-alarms.ts"
import { mapMobileNetworkAlarm } from "../lib/mobile/v1/alarms/map-mobile-network-alarm.ts"
import { MobileApiError } from "../lib/mobile/v1/errors.ts"
import { stripNetworkSecrets } from "../lib/network/secrets.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function sampleAlarm(overrides = {}) {
  return {
    id: "alarm-1",
    companyId: "company-a",
    deviceId: "device-1",
    severity: "critical",
    status: "open",
    title: "Core offline",
    message: "Core pasó a offline.",
    rootAlarmId: null,
    isRoot: true,
    createdAt: "2026-10-05T12:00:00.000Z",
    seenAt: null,
    acknowledgedAt: null,
    acknowledgedBy: "user-secret",
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    mttaMs: null,
    mttrMs: 1200,
    password: "should-not-leak",
    secret_ciphertext: "cipher",
    ...overrides,
  }
}

const route = read("app/api/mobile/v1/alarms/route.ts")
const service = read("lib/mobile/v1/alarms/list-mobile-network-alarms.ts")
const webAlarms = read("app/api/network/v1/alarms/route.ts")
const middleware = read("lib/mobile/v1/auth/mobile-bearer-middleware.ts")
const resolver = read("lib/mobile/v1/auth/mobile-token-resolver.ts")

test("1. Bearer válido + usuario Mobile elegible usa el gate protegido", () => {
  assert.match(route, /handleProtectedMobileRoute/)
  assert.match(route, /requireAuthenticatedUser/)
  assert.match(route, /listMobileNetworkAlarms/)
  assert.match(route, /mobileApiSuccessResponse/)
  assert.equal(canReadMobileNetworkAlarms("operario"), true)
  assert.equal(canReadMobileNetworkAlarms("supervisor"), true)
  assert.doesNotThrow(() => assertCanReadMobileNetworkAlarms("operario"))
})

test("2. Sin Bearer → 401 UNAUTHORIZED", () => {
  assert.match(middleware, /extractBearerToken/)
  const missing = middleware.slice(
    middleware.indexOf('stage: "missing_bearer_token"')
  )
  assert.match(missing, /UNAUTHORIZED/)
  assert.match(missing, /,\s*401/)
})

test("3. Bearer inválido → 401 UNAUTHORIZED", () => {
  assert.match(resolver, /auth\.getUser\(accessToken\)/)
  assert.match(resolver, /UNAUTHORIZED/)
  assert.match(resolver, /,\s*401/)
})

test("4. Usuario no elegible para Mobile Alarmas → 403", () => {
  assert.equal(canReadMobileNetworkAlarms("administrativo"), false)
  assert.throws(
    () => assertCanReadMobileNetworkAlarms("administrativo"),
    (error) =>
      error instanceof MobileApiError &&
      error.code === "FORBIDDEN" &&
      error.status === 403
  )
  assert.doesNotMatch(service, /canAccessNetworkModule/)
  assert.doesNotMatch(service, /moduleVisibility/)
  assert.doesNotMatch(route, /moduleVisibility\.network/)
})

test("5. Usuario válido → solamente alarmas de su company", () => {
  assert.match(service, /resolveMobileNetworkAlarmsCompanyId/)
  assert.match(service, /auth\.companyId/)
  const companyId = resolveMobileNetworkAlarmsCompanyId("company-a")
  assert.equal(companyId, "company-a")
})

test("6. Intento de enviar otro companyId → no altera el tenant", () => {
  const access = read("lib/mobile/v1/alarms/can-read-mobile-network-alarms.ts")
  const companyId = resolveMobileNetworkAlarmsCompanyId(
    "company-a",
    "company-from-client"
  )
  assert.equal(companyId, "company-a")
  assert.match(route, /url\.searchParams\.get\("companyId"\)/)
  assert.match(access, /void requestedCompanyId/)
  assert.match(service, /auth\.companyId/)
  assert.doesNotMatch(service, /listNetworkAlarms\(client, requestedCompanyId\)/)
})

test("7. Empresa sin alarmas → lista vacía", () => {
  assert.match(service, /alarms: alarms\.map\(mapMobileNetworkAlarm\)/)
  const empty = [].map(mapMobileNetworkAlarm)
  assert.deepEqual(empty, [])
})

test("8. Envelope { success, data }", () => {
  assert.match(route, /mobileApiSuccessResponse\(context\.request, data\)/)
  const factory = read("lib/mobile/v1/response-factory.ts")
  assert.match(factory, /success: true/)
  assert.match(factory, /data,/)
  assert.doesNotMatch(route, /success: true,\s*alarms/)
})

test("9. Alarmas open, acknowledged y resolved se conservan", () => {
  const open = mapMobileNetworkAlarm(sampleAlarm({ status: "open" }))
  const acknowledged = mapMobileNetworkAlarm(
    sampleAlarm({ id: "alarm-2", status: "acknowledged" })
  )
  const resolved = mapMobileNetworkAlarm(
    sampleAlarm({
      id: "alarm-3",
      status: "resolved",
      resolvedAt: "2026-10-05T13:00:00.000Z",
    })
  )
  assert.equal(open.status, "open")
  assert.equal(acknowledged.status, "acknowledged")
  assert.equal(resolved.status, "resolved")
  assert.equal(resolved.resolvedAt, "2026-10-05T13:00:00.000Z")
  assert.match(service, /listNetworkAlarms\(client, companyId\)/)
  assert.doesNotMatch(service, /status:\s*"open"/)
})

test("10. No expone campos sensibles", () => {
  const mapped = mapMobileNetworkAlarm(sampleAlarm())
  const json = JSON.stringify(stripNetworkSecrets(mapped))
  assert.equal("password" in mapped, false)
  assert.equal("secret_ciphertext" in mapped, false)
  assert.equal("acknowledgedBy" in mapped, false)
  assert.equal("resolvedBy" in mapped, false)
  assert.equal("mttrMs" in mapped, false)
  assert.equal(json.includes("should-not-leak"), false)
  assert.equal(json.includes("cipher"), false)
  assert.equal(json.includes("user-secret"), false)
  assert.equal(mapped.deviceId, "device-1")
  assert.equal(mapped.title, "Core offline")
  assert.equal(mapped.message, "Core pasó a offline.")
})

test("mustChangePassword sigue el hotfix Mobile: el gate no bloquea", () => {
  assert.doesNotMatch(route, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(route, /allowPasswordChangeRequired:\s*true/)
  assert.match(
    resolver,
    /Password-change enforcement for Mobile is temporarily disabled/
  )
})

test("no modifica el endpoint web ni usa cookies", () => {
  assert.match(webAlarms, /requireNetworkReadContext/)
  assert.doesNotMatch(webAlarms, /mobileBearerMiddleware/)
  assert.doesNotMatch(webAlarms, /extractBearerToken/)
  assert.match(route, /handleProtectedMobileRoute/)
  assert.doesNotMatch(route, /createClient\(\)/)
  assert.match(service, /createAdminClient/)
  assert.match(middleware, /extractBearerToken/)
})
