/**
 * Bespoke Mobile — GPS validation on POST /api/mobile/v1/shifts/start.
 * Source-contract + in-memory policy. Does not hit a live database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { calculateDistanceMeters } from "../lib/mobile/v1/tasks/geo-utils.ts"
import { MobileApiError } from "../lib/mobile/v1/errors.ts"
import {
  DEFAULT_SHIFT_LOCATION_VALIDATION_ENABLED,
  DEFAULT_SHIFT_RADIUS_METERS,
  SHIFT_LOCATION_REQUIRED_MESSAGE,
  evaluateShiftStartLocationPolicy,
  mapCompanyShiftLocationSettings,
} from "../lib/mobile/v1/shifts/shift-location-validation.ts"
import { validateMobileShiftStartRequest } from "../lib/mobile/v1/shifts/validate-shift-request.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const shiftService = read("lib/mobile/v1/shifts/shift-service.ts")
const loader = read("lib/mobile/v1/shifts/shift-start-location.server.ts")
const policy = read("lib/mobile/v1/shifts/shift-location-validation.ts")
const validate = read("lib/mobile/v1/shifts/validate-shift-request.ts")
const errors = read("lib/mobile/v1/errors.ts")
const geoUtils = read("lib/mobile/v1/tasks/geo-utils.ts")
const taskStart = read("lib/mobile/v1/tasks/task-start-service.ts")
const presenceRadius = read("lib/presence/operational-radius.server.ts")

const BASE = { latitude: -31.4201, longitude: -64.1888 }
const NEAR = { latitude: -31.42015, longitude: -64.18885 }
const FAR = { latitude: -31.4301, longitude: -64.1888 }

function settingsForCompany(rows, companyId) {
  return mapCompanyShiftLocationSettings(
    rows.find((row) => row.company_id === companyId) ?? null
  )
}

function tryStartShift(input) {
  if (input.alreadyActive) {
    return { started: false, code: "SHIFT_ALREADY_ACTIVE" }
  }

  const settings = settingsForCompany(input.settingsRows, input.authCompanyId)
  const policyResult = evaluateShiftStartLocationPolicy({
    validationEnabled: settings.shiftLocationValidationEnabled,
    radiusMeters: settings.shiftRadiusMeters,
    deviceLatitude: input.device.latitude,
    deviceLongitude: input.device.longitude,
    referenceLatitude: input.reference?.latitude ?? null,
    referenceLongitude: input.reference?.longitude ?? null,
  })

  if (policyResult.shouldBlock) {
    return { started: false, code: policyResult.code, policy: policyResult }
  }

  return { started: true, code: null, policy: policyResult }
}

const COMPANY_A = "co-a"
const COMPANY_B = "co-b"

const SETTINGS_A_ON_150 = {
  company_id: COMPANY_A,
  shift_location_validation_enabled: true,
  shift_radius_meters: 150,
}

const SETTINGS_A_ON_50 = {
  company_id: COMPANY_A,
  shift_location_validation_enabled: true,
  shift_radius_meters: 50,
}

const SETTINGS_B_ON_50 = {
  company_id: COMPANY_B,
  shift_location_validation_enabled: true,
  shift_radius_meters: 50,
}

const SETTINGS_A_OFF = {
  company_id: COMPANY_A,
  shift_location_validation_enabled: false,
  shift_radius_meters: 150,
}

test("A. validation OFF → jornada inicia como antes", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_OFF],
    device: FAR,
    reference: BASE,
    alreadyActive: false,
  })
  assert.equal(result.started, true)
  assert.equal(result.policy.shouldValidate, false)
  assert.equal(DEFAULT_SHIFT_LOCATION_VALIDATION_ENABLED, false)
})

test("B. validation ON + dentro del radio → jornada inicia", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    reference: BASE,
    alreadyActive: false,
  })
  assert.equal(result.started, true)
  assert.equal(result.policy.withinRadius, true)
  assert.ok(result.policy.distanceMeters < 150)
})

test("C. validation ON + exactamente en el límite → jornada inicia", () => {
  const distance = calculateDistanceMeters(
    NEAR.latitude,
    NEAR.longitude,
    BASE.latitude,
    BASE.longitude
  )
  const result = evaluateShiftStartLocationPolicy({
    validationEnabled: true,
    radiusMeters: distance,
    deviceLatitude: NEAR.latitude,
    deviceLongitude: NEAR.longitude,
    referenceLatitude: BASE.latitude,
    referenceLongitude: BASE.longitude,
  })
  assert.equal(result.shouldBlock, false)
  assert.equal(result.withinRadius, true)
  assert.equal(result.distanceMeters, distance)
})

test("D. validation ON + fuera del radio → jornada rechazada", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: FAR,
    reference: BASE,
    alreadyActive: false,
  })
  assert.equal(result.started, false)
  assert.equal(result.code, "SHIFT_LOCATION_OUT_OF_RANGE")
  assert.match(errors, /"SHIFT_LOCATION_OUT_OF_RANGE"/)
  assert.ok(result.policy.distanceMeters > 150)
})

test("E. empresa con radio 50 m usa 50 m, no 150 m", () => {
  const mid = { latitude: -31.4207, longitude: -64.1888 }
  const distance = calculateDistanceMeters(
    mid.latitude,
    mid.longitude,
    BASE.latitude,
    BASE.longitude
  )
  assert.ok(distance > 50)
  assert.ok(distance < 150)

  const with50 = evaluateShiftStartLocationPolicy({
    validationEnabled: true,
    radiusMeters: 50,
    deviceLatitude: mid.latitude,
    deviceLongitude: mid.longitude,
    referenceLatitude: BASE.latitude,
    referenceLongitude: BASE.longitude,
  })
  const with150 = evaluateShiftStartLocationPolicy({
    validationEnabled: true,
    radiusMeters: 150,
    deviceLatitude: mid.latitude,
    deviceLongitude: mid.longitude,
    referenceLatitude: BASE.latitude,
    referenceLongitude: BASE.longitude,
  })
  assert.equal(with50.shouldBlock, true)
  assert.equal(with150.shouldBlock, false)
})

test("F. empresa con radio 150 m usa 150 m", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    reference: BASE,
    alreadyActive: false,
  })
  assert.equal(result.started, true)
  assert.equal(
    settingsForCompany([SETTINGS_A_ON_150], COMPANY_A).shiftRadiusMeters,
    150
  )
  assert.equal(DEFAULT_SHIFT_RADIUS_METERS, 150)
})

test("G. empresa A no puede utilizar configuración de empresa B", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150, SETTINGS_B_ON_50],
    device: FAR,
    reference: BASE,
    alreadyActive: false,
  })
  assert.equal(
    settingsForCompany([SETTINGS_A_ON_150, SETTINGS_B_ON_50], COMPANY_A)
      .shiftRadiusMeters,
    150
  )
  assert.equal(
    settingsForCompany([SETTINGS_A_ON_150, SETTINGS_B_ON_50], COMPANY_B)
      .shiftRadiusMeters,
    50
  )
  assert.equal(result.started, false)
  assert.match(loader, /\.eq\("company_id", companyId\)/)
  assert.match(shiftService, /loadCompanyShiftLocationSettings\(admin, auth\.companyId\)/)
  assert.match(
    shiftService,
    /loadCrewOperationalBaseCoordinates\(\s*admin,\s*auth\.companyId,\s*resolved\.workTeamId/
  )
})

test("H. configuración ON sin ubicación de referencia → error", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    reference: null,
    alreadyActive: false,
  })
  assert.equal(result.started, false)
  assert.equal(result.code, "SHIFT_LOCATION_REQUIRED")
  assert.equal(result.policy.message, SHIFT_LOCATION_REQUIRED_MESSAGE)
  assert.match(errors, /"SHIFT_LOCATION_REQUIRED"/)
})

test("I. coordenadas inválidas → error apropiado", () => {
  assert.throws(
    () =>
      validateMobileShiftStartRequest({
        deviceId: "dev-1",
        latitude: 91,
        longitude: -64.18,
      }),
    (error) =>
      error instanceof MobileApiError &&
      error.code === "INVALID_REQUEST" &&
      error.status === 400
  )
  assert.throws(
    () =>
      validateMobileShiftStartRequest({
        deviceId: "dev-1",
        latitude: -31.42,
        longitude: 181,
      }),
    (error) =>
      error instanceof MobileApiError && error.code === "INVALID_REQUEST"
  )
  assert.throws(
    () =>
      validateMobileShiftStartRequest({
        deviceId: "dev-1",
        latitude: "sur",
        longitude: -64.18,
      }),
    (error) =>
      error instanceof MobileApiError && error.code === "INVALID_REQUEST"
  )
  assert.match(validate, /hasCoordinates/)
})

test("J. intento rechazado por distancia NO crea inicio exitoso", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_50],
    device: FAR,
    reference: BASE,
    alreadyActive: false,
  })
  assert.equal(result.started, false)
  const policyAt = shiftService.indexOf("evaluateShiftStartLocationPolicy")
  const insertAt = shiftService.indexOf("insertWorkTeamShift")
  assert.ok(policyAt > 0 && insertAt > policyAt)
  assert.match(shiftService, /policy\.shouldBlock/)
})

test("K. companyId enviado por cliente no puede cambiar la configuración", () => {
  const parsed = validateMobileShiftStartRequest({
    deviceId: "dev-1",
    latitude: BASE.latitude,
    longitude: BASE.longitude,
    companyId: COMPANY_B,
  })
  assert.equal(parsed.deviceId, "dev-1")
  assert.equal(parsed.latitude, BASE.latitude)
  assert.doesNotMatch(validate, /companyId/)
  assert.doesNotMatch(shiftService, /request\.companyId/)
  assert.doesNotMatch(loader, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.doesNotMatch(shiftService, /resolveTenantCompanyId/)
})

test("L. empresa existente sin configuración mantiene comportamiento actual", () => {
  const result = tryStartShift({
    authCompanyId: COMPANY_A,
    settingsRows: [],
    device: FAR,
    reference: null,
    alreadyActive: false,
  })
  assert.equal(result.started, true)
  assert.equal(result.policy.shouldValidate, false)
  assert.deepEqual(mapCompanyShiftLocationSettings(null), {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 150,
  })
  assert.doesNotMatch(loader, /\.insert\(/)
  assert.doesNotMatch(shiftService, /from\("company_mobile_settings"\)/)
})

test("fuente de configuración y referencia; no usa OT ni presence", () => {
  assert.match(loader, /from\("company_mobile_settings"\)/)
  assert.match(loader, /from\("crews"\)/)
  assert.match(loader, /operational_base_latitude/)
  assert.match(loader, /operational_base_longitude/)
  assert.match(policy, /calculateDistanceMeters/)
  assert.doesNotMatch(policy, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(policy, /TASK_START_DISTANCE_ENFORCEMENT/)
  assert.doesNotMatch(shiftService, /presence_engine_settings/)
  assert.doesNotMatch(loader, /getOperationalPresenceRadiusMeters/)
  assert.doesNotMatch(taskStart, /company_mobile_settings/)
  assert.doesNotMatch(presenceRadius, /company_mobile_settings/)
  assert.match(geoUtils, /TASK_START_MAX_DISTANCE_METERS = 50/)
  assert.match(geoUtils, /TASK_START_DISTANCE_ENFORCEMENT_ENABLED = false/)
})
