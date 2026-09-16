/**
 * GPS Operations 1.0 — admin GET/PUT for company_mobile_settings GPS fields.
 * Source-contract + in-memory policy. Does not hit a live database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  canManageCompanyGpsSettings,
  canReadCompanyGpsSettings,
} from "../lib/company-gps-settings/access.ts"
import { DEFAULT_COMPANY_GPS_SETTINGS } from "../lib/company-gps-settings/constants.ts"
import { parseCompanyGpsSettingsPut } from "../lib/company-gps-settings/validate.ts"
import { evaluateTaskStartDistancePolicy } from "../lib/mobile/v1/tasks/geo-utils.ts"
import {
  DEFAULT_TASK_RADIUS_METERS,
  mapCompanyTaskLocationSettings,
} from "../lib/mobile/v1/tasks/task-location-validation.ts"
import {
  DEFAULT_SHIFT_RADIUS_METERS,
  evaluateShiftStartLocationPolicy,
  mapCompanyShiftLocationSettings,
} from "../lib/mobile/v1/shifts/shift-location-validation.ts"
import { DEFAULT_MOBILE_BOOTSTRAP_OPERATIONS } from "../lib/mobile/v1/bootstrap/map-bootstrap-response.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const route = read("app/api/company-gps-settings/route.ts")
const queries = read("lib/supabase/company-gps-settings.queries.ts")
const hub = read("components/configuracion/configuration-hub-panel.tsx")
const page = read(
  "components/configuracion/company-gps-settings-config-page.tsx"
)
const startService = read("lib/mobile/v1/tasks/task-start-service.ts")
const shiftService = read("lib/mobile/v1/shifts/shift-service.ts")
const geoUtils = read("lib/mobile/v1/tasks/geo-utils.ts")
const bootstrapService = read("lib/mobile/v1/bootstrap/bootstrap-service.ts")
const bootstrapMapper = read("lib/mobile/v1/bootstrap/map-bootstrap-response.ts")
const bootstrapTypes = read("lib/mobile/v1/bootstrap/types.ts")
const presenceRadius = read("lib/presence/operational-radius.server.ts")
const presenceConstants = read("lib/presence/constants.ts")
const gpsIngestReadme = read("app/api/mobile/v1/gps/README.md")

const COMPANY_A = "co-abnet"
const COMPANY_B = "co-other"

function getSettings(store, sessionCompanyId) {
  return store.get(sessionCompanyId) ?? { ...DEFAULT_COMPANY_GPS_SETTINGS }
}

function putSettings(store, sessionCompanyId, body) {
  const parsed = parseCompanyGpsSettingsPut(body)
  if (!parsed.ok) {
    return { ok: false, message: parsed.message, status: 400 }
  }
  store.set(sessionCompanyId, parsed.settings)
  return { ok: true, settings: parsed.settings, status: 200 }
}

test("solo administrador puede modificar GPS; GET exige empresa de sesión", () => {
  assert.equal(
    canManageCompanyGpsSettings({
      systemRole: "administrador",
      roleCode: "administrador",
    }),
    true
  )
  assert.equal(
    canManageCompanyGpsSettings({
      systemRole: "supervisor",
      roleCode: "supervisor",
    }),
    false
  )
  assert.equal(canManageCompanyGpsSettings(null), false)
  assert.equal(canReadCompanyGpsSettings({ companyId: COMPANY_A }), true)
  assert.equal(canReadCompanyGpsSettings({ companyId: "  " }), false)
  assert.match(route, /canManageCompanyGpsSettings/)
  assert.match(route, /requireWritablePlatformSession/)
  assert.match(route, /auth\.sessionUser\.companyId/)
  assert.match(route, /sessionUser\.companyId/)
  assert.doesNotMatch(route, /searchParams/)
  assert.doesNotMatch(route, /body\.companyId/)
  assert.doesNotMatch(route, /parsed\.companyId/)
})

test("GET sin fila devuelve defaults jornada/OT OFF 150 m", () => {
  const store = new Map()
  assert.deepEqual(getSettings(store, COMPANY_A), {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 150,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 150,
  })
  assert.equal(DEFAULT_SHIFT_RADIUS_METERS, 150)
  assert.equal(DEFAULT_TASK_RADIUS_METERS, 150)
  assert.equal(DEFAULT_COMPANY_GPS_SETTINGS.shiftLocationValidationEnabled, false)
  assert.equal(DEFAULT_COMPANY_GPS_SETTINGS.taskLocationValidationEnabled, false)
  assert.doesNotMatch(queries, /\.insert\(/)
  assert.match(queries, /mapCompanyGpsSettings\(data \?\? null\)/)
})

test("PUT crea/actualiza la fila del tenant de sesión e ignora companyId del body", () => {
  const store = new Map()
  const result = putSettings(store, COMPANY_A, {
    companyId: COMPANY_B,
    shiftLocationValidationEnabled: true,
    shiftRadiusMeters: 200,
    taskLocationValidationEnabled: true,
    taskRadiusMeters: 80,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(getSettings(store, COMPANY_A), {
    shiftLocationValidationEnabled: true,
    shiftRadiusMeters: 200,
    taskLocationValidationEnabled: true,
    taskRadiusMeters: 80,
  })
  assert.deepEqual(getSettings(store, COMPANY_B), DEFAULT_COMPANY_GPS_SETTINGS)
  assert.match(queries, /upsert\(/)
  assert.match(queries, /company_id: companyId/)
  assert.match(queries, /onConflict: "company_id"/)
  assert.doesNotMatch(queries, /gps_heartbeat/)
  assert.match(route, /createAdminClient/)
  assert.match(route, /upsertCompanyGpsSettings\(admin, companyId/)
})

test("radios inválidos se rechazan; enteros 1–10000 se aceptan", () => {
  const valid = {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 150,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 150,
  }
  assert.equal(parseCompanyGpsSettingsPut(valid).ok, true)
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, shiftRadiusMeters: 1 }).ok,
    true
  )
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, taskRadiusMeters: 10000 }).ok,
    true
  )
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, shiftRadiusMeters: 0 }).ok,
    false
  )
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, shiftRadiusMeters: -1 }).ok,
    false
  )
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, taskRadiusMeters: 10001 }).ok,
    false
  )
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, shiftRadiusMeters: 150.5 }).ok,
    false
  )
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, taskRadiusMeters: "150" }).ok,
    false
  )
  assert.equal(
    parseCompanyGpsSettingsPut({ ...valid, shiftLocationValidationEnabled: 1 })
      .ok,
    false
  )
})

test("jornada y OT ON/OFF se persisten de forma independiente", () => {
  const store = new Map()
  putSettings(store, COMPANY_A, {
    shiftLocationValidationEnabled: true,
    shiftRadiusMeters: 120,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 300,
  })
  const saved = getSettings(store, COMPANY_A)
  assert.equal(saved.shiftLocationValidationEnabled, true)
  assert.equal(saved.taskLocationValidationEnabled, false)
  assert.equal(saved.shiftRadiusMeters, 120)
  assert.equal(saved.taskRadiusMeters, 300)
})

test("cambiar ABNet no afecta a otra empresa", () => {
  const store = new Map()
  putSettings(store, COMPANY_A, {
    shiftLocationValidationEnabled: true,
    shiftRadiusMeters: 200,
    taskLocationValidationEnabled: true,
    taskRadiusMeters: 80,
  })
  putSettings(store, COMPANY_B, {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 999,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 10,
  })
  assert.equal(getSettings(store, COMPANY_A).shiftRadiusMeters, 200)
  assert.equal(getSettings(store, COMPANY_B).shiftRadiusMeters, 999)
  assert.notEqual(
    getSettings(store, COMPANY_A).taskRadiusMeters,
    getSettings(store, COMPANY_B).taskRadiusMeters
  )
})

test("inicio de jornada usa el radio tenant, no un global", () => {
  const settings = mapCompanyShiftLocationSettings({
    shift_location_validation_enabled: true,
    shift_radius_meters: 200,
  })
  const far = evaluateShiftStartLocationPolicy({
    validationEnabled: settings.shiftLocationValidationEnabled,
    radiusMeters: settings.shiftRadiusMeters,
    deviceLatitude: -31.43,
    deviceLongitude: -64.2,
    referenceLatitude: -31.4167,
    referenceLongitude: -64.1833,
  })
  assert.equal(far.shouldBlock, true)
  const near = evaluateShiftStartLocationPolicy({
    validationEnabled: true,
    radiusMeters: 50_000,
    deviceLatitude: -31.43,
    deviceLongitude: -64.2,
    referenceLatitude: -31.4167,
    referenceLongitude: -64.1833,
  })
  assert.equal(near.shouldBlock, false)
  assert.match(shiftService, /settings\.shiftLocationValidationEnabled/)
  assert.match(shiftService, /radiusMeters: settings\.shiftRadiusMeters/)
  assert.match(shiftService, /loadCompanyShiftLocationSettings/)
})

test("inicio de OT usa el radio tenant; 50 m y env global no prevalecen", () => {
  const tenant = mapCompanyTaskLocationSettings({
    task_location_validation_enabled: true,
    task_radius_meters: 150,
  })
  const mid = {
    operatorLatitude: -31.4173,
    operatorLongitude: -64.1833,
    targetLatitude: -31.4167,
    targetLongitude: -64.1833,
  }
  const with50 = evaluateTaskStartDistancePolicy({
    ...mid,
    enforcementEnabled: true,
    maxDistanceMeters: 50,
  })
  const withTenant = evaluateTaskStartDistancePolicy({
    ...mid,
    enforcementEnabled: tenant.taskLocationValidationEnabled,
    maxDistanceMeters: tenant.taskRadiusMeters,
  })
  assert.equal(with50.shouldBlock, true)
  assert.equal(withTenant.shouldBlock, false)
  assert.equal(tenant.taskRadiusMeters, 150)

  const previous = process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED
  process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED = "true"
  const stillOff = evaluateTaskStartDistancePolicy({
    ...mid,
    operatorLatitude: -31.43,
    operatorLongitude: -64.2,
    enforcementEnabled: false,
    maxDistanceMeters: 150,
  })
  if (previous == null) {
    delete process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED
  } else {
    process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED = previous
  }
  assert.equal(stillOff.shouldBlock, false)

  assert.match(
    startService,
    /enforcementEnabled: settings\.taskLocationValidationEnabled/
  )
  assert.match(startService, /maxDistanceMeters: settings\.taskRadiusMeters/)
  assert.doesNotMatch(startService, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(startService, /TASK_START_DISTANCE_ENFORCEMENT/)
  assert.doesNotMatch(startService, /isTaskStartDistanceEnforcementEnabled/)
  assert.doesNotMatch(geoUtils, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(geoUtils, /TASK_START_DISTANCE_ENFORCEMENT/)
  assert.doesNotMatch(geoUtils, /process\.env/)
})

test("bootstrap conserva el contrato operations actual", () => {
  assert.deepEqual(DEFAULT_MOBILE_BOOTSTRAP_OPERATIONS, {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 150,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 150,
    gpsHeartbeatEnabled: true,
    gpsHeartbeatIntervalSeconds: 60,
  })
  assert.match(bootstrapTypes, /shiftLocationValidationEnabled: boolean/)
  assert.match(bootstrapTypes, /shiftRadiusMeters: number/)
  assert.match(bootstrapTypes, /taskLocationValidationEnabled: boolean/)
  assert.match(bootstrapTypes, /taskRadiusMeters: number/)
  assert.match(bootstrapTypes, /gpsHeartbeatEnabled: boolean/)
  assert.match(bootstrapTypes, /gpsHeartbeatIntervalSeconds: number/)
  assert.match(bootstrapService, /from\("company_mobile_settings"\)/)
  assert.doesNotMatch(bootstrapMapper, /company-gps-settings/)
})

test("Presence y tracking continuo no se tocan", () => {
  assert.match(
    presenceConstants,
    /DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS = 150/
  )
  assert.match(presenceRadius, /presence_engine_settings/)
  assert.doesNotMatch(presenceRadius, /company_mobile_settings/)
  assert.doesNotMatch(queries, /presence_engine_settings/)
  assert.doesNotMatch(route, /presence_engine_settings/)
  assert.doesNotMatch(page, /anti-spoof/)
  assert.doesNotMatch(page, /\/api\/mobile\/v1\/gps/)
  assert.match(gpsIngestReadme, /placeholder/i)
})

test("Configuración → Operación → Geolocalización existe y es admin-only", () => {
  assert.match(hub, /title: "Geolocalización"/)
  assert.match(hub, /href: "\/configuracion\/geolocalizacion"/)
  assert.match(hub, /canAccessGpsSettings/)
  assert.match(hub, /canManageCompanyGpsSettings/)
  assert.match(page, /Validar GPS al iniciar jornada/)
  assert.match(page, /Validar GPS al iniciar OT/)
  assert.match(page, /Radio de validación de jornada/)
  assert.match(page, /Radio de validación de OT/)
  assert.match(
    page,
    /Define el radio permitido alrededor de la ubicación de referencia para iniciar la jornada/
  )
  assert.match(
    page,
    /Define el radio permitido alrededor de la OT\/obra para iniciar una OT/
  )
  assert.match(page, /disabled=\{!settings\.shiftLocationValidationEnabled\}/)
  assert.match(page, /disabled=\{!settings\.taskLocationValidationEnabled\}/)
  assert.match(page, /\{settings\.shiftRadiusMeters\} m/)
  assert.match(page, /\{settings\.taskRadiusMeters\} m/)
  assert.doesNotMatch(page, /KPI/)
  assert.doesNotMatch(page, /google\.com\/maps/)
})
