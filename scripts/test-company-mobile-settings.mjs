/**
 * Bespoke Mobile — company_mobile_settings + bootstrap operations contract.
 * Source-contract + in-memory lookup. Does not hit a live database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  DEFAULT_MOBILE_BOOTSTRAP_OPERATIONS,
  mapMobileBootstrapOperations,
  mapMobileBootstrapResponse,
} from "../lib/mobile/v1/bootstrap/map-bootstrap-response.ts"
import { validateMobileBootstrapRequest } from "../lib/mobile/v1/bootstrap/validate-bootstrap-request.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const migration = read(
  "supabase/migrations/20261223000100_company_mobile_settings.sql"
)
const types = read("lib/supabase/database.types.ts")
const service = read("lib/mobile/v1/bootstrap/bootstrap-service.ts")
const mapper = read("lib/mobile/v1/bootstrap/map-bootstrap-response.ts")
const bootstrapTypes = read("lib/mobile/v1/bootstrap/types.ts")
const docs = read("docs/mobile-api.md")
const shiftService = read("lib/mobile/v1/shifts/shift-service.ts")
const taskStartService = read("lib/mobile/v1/tasks/task-start-service.ts")
const geoUtils = read("lib/mobile/v1/tasks/geo-utils.ts")
const presenceSettings = read("lib/presence/operational-radius.server.ts")
const presenceMigration = read(
  "supabase/migrations/20261113000100_presence_engine_1_0.sql"
)

const RADIUS_MAX = 10000
const HEARTBEAT_MAX = 86400

function findActiveCompanyByMobileCode(companies, rawCode) {
  const normalized =
    typeof rawCode === "string" ? rawCode.trim().toLowerCase() : ""
  if (!normalized) {
    return null
  }
  return (
    companies.find((company) => {
      if (company.deleted_at != null) {
        return false
      }
      const stored =
        typeof company.mobile_code === "string"
          ? company.mobile_code.trim().toLowerCase()
          : ""
      return stored !== "" && stored === normalized
    }) ?? null
  )
}

function findSettingsForCompany(rows, companyId) {
  return rows.find((row) => row.company_id === companyId) ?? null
}

function bootstrapForCode(companies, settingsRows, rawCode) {
  const company = findActiveCompanyByMobileCode(companies, rawCode)
  if (!company) {
    return null
  }
  return mapMobileBootstrapResponse({
    companyId: company.id,
    companyName: company.name,
    branding: null,
    operations: findSettingsForCompany(settingsRows, company.id),
  })
}

function canPersistMobileSettings(row) {
  if (
    typeof row.shift_location_validation_enabled !== "boolean" ||
    typeof row.task_location_validation_enabled !== "boolean" ||
    typeof row.gps_heartbeat_enabled !== "boolean"
  ) {
    return false
  }
  if (
    !Number.isInteger(row.shift_radius_meters) ||
    row.shift_radius_meters <= 0 ||
    row.shift_radius_meters > RADIUS_MAX
  ) {
    return false
  }
  if (
    !Number.isInteger(row.task_radius_meters) ||
    row.task_radius_meters <= 0 ||
    row.task_radius_meters > RADIUS_MAX
  ) {
    return false
  }
  if (
    !Number.isInteger(row.gps_heartbeat_interval_seconds) ||
    row.gps_heartbeat_interval_seconds <= 0 ||
    row.gps_heartbeat_interval_seconds > HEARTBEAT_MAX
  ) {
    return false
  }
  return true
}

const ABNET = {
  id: "co-abnet",
  name: "ABNet",
  mobile_code: "abnet",
  deleted_at: null,
}

const OTHER = {
  id: "co-other",
  name: "Otra",
  mobile_code: "otra",
  deleted_at: null,
}

const ABNET_SETTINGS = {
  company_id: "co-abnet",
  shift_location_validation_enabled: true,
  shift_radius_meters: 200,
  task_location_validation_enabled: true,
  task_radius_meters: 80,
  gps_heartbeat_enabled: false,
  gps_heartbeat_interval_seconds: 120,
}

const OTHER_SETTINGS = {
  company_id: "co-other",
  shift_location_validation_enabled: false,
  shift_radius_meters: 999,
  task_location_validation_enabled: false,
  task_radius_meters: 10,
  gps_heartbeat_enabled: true,
  gps_heartbeat_interval_seconds: 30,
}

test("migración: 1:1 con companies, defaults y timestamps", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.company_mobile_settings/)
  assert.match(migration, /company_id uuid PRIMARY KEY REFERENCES public\.companies/)
  assert.match(
    migration,
    /shift_location_validation_enabled boolean NOT NULL DEFAULT false/
  )
  assert.match(migration, /shift_radius_meters integer NOT NULL DEFAULT 150/)
  assert.match(
    migration,
    /task_location_validation_enabled boolean NOT NULL DEFAULT false/
  )
  assert.match(migration, /task_radius_meters integer NOT NULL DEFAULT 150/)
  assert.match(migration, /gps_heartbeat_enabled boolean NOT NULL DEFAULT true/)
  assert.match(
    migration,
    /gps_heartbeat_interval_seconds integer NOT NULL DEFAULT 60/
  )
  assert.match(migration, /created_at timestamptz NOT NULL DEFAULT now\(\)/)
  assert.match(migration, /updated_at timestamptz NOT NULL DEFAULT now\(\)/)
  assert.doesNotMatch(migration, /INSERT INTO public\.company_mobile_settings/)
  assert.match(types, /company_mobile_settings:/)
})

test("migración: RLS SELECT por tenant, sin políticas públicas de escritura", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /auth_user_company_id\(\)/)
  assert.match(migration, /FOR SELECT/)
  assert.doesNotMatch(migration, /FOR INSERT/)
  assert.doesNotMatch(migration, /FOR UPDATE/)
  assert.doesNotMatch(migration, /TO anon/)
  assert.doesNotMatch(migration, /TO PUBLIC/)
})

test("A. empresa con configuración devuelve los valores configurados", () => {
  const data = bootstrapForCode([ABNET], [ABNET_SETTINGS], "ABNET")
  assert.deepEqual(data.operations, {
    shiftLocationValidationEnabled: true,
    shiftRadiusMeters: 200,
    taskLocationValidationEnabled: true,
    taskRadiusMeters: 80,
    gpsHeartbeatEnabled: false,
    gpsHeartbeatIntervalSeconds: 120,
  })
  assert.match(service, /from\("company_mobile_settings"\)/)
  assert.match(docs, /"shiftLocationValidationEnabled"/)
})

test("B. empresa sin configuración devuelve defaults", () => {
  const data = bootstrapForCode([ABNET], [], "ABNET")
  assert.deepEqual(data.operations, DEFAULT_MOBILE_BOOTSTRAP_OPERATIONS)
  assert.deepEqual(mapMobileBootstrapOperations(null), {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 150,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 150,
    gpsHeartbeatEnabled: true,
    gpsHeartbeatIntervalSeconds: 60,
  })
})

test("C. shift validation puede ser true/false", () => {
  assert.equal(
    bootstrapForCode([ABNET], [ABNET_SETTINGS], "ABNET").operations
      .shiftLocationValidationEnabled,
    true
  )
  assert.equal(
    bootstrapForCode(
      [ABNET],
      [{ ...ABNET_SETTINGS, shift_location_validation_enabled: false }],
      "ABNET"
    ).operations.shiftLocationValidationEnabled,
    false
  )
})

test("D. task validation puede ser true/false", () => {
  assert.equal(
    bootstrapForCode([ABNET], [ABNET_SETTINGS], "ABNET").operations
      .taskLocationValidationEnabled,
    true
  )
  assert.equal(
    bootstrapForCode(
      [ABNET],
      [{ ...ABNET_SETTINGS, task_location_validation_enabled: false }],
      "ABNET"
    ).operations.taskLocationValidationEnabled,
    false
  )
})

test("E. shift radius se devuelve correctamente", () => {
  assert.equal(
    bootstrapForCode([ABNET], [ABNET_SETTINGS], "ABNET").operations
      .shiftRadiusMeters,
    200
  )
})

test("F. task radius se devuelve correctamente", () => {
  assert.equal(
    bootstrapForCode([ABNET], [ABNET_SETTINGS], "ABNET").operations
      .taskRadiusMeters,
    80
  )
})

test("G. heartbeat y su intervalo se devuelven correctamente", () => {
  const data = bootstrapForCode([ABNET], [ABNET_SETTINGS], "ABNET")
  assert.equal(data.operations.gpsHeartbeatEnabled, false)
  assert.equal(data.operations.gpsHeartbeatIntervalSeconds, 120)
})

test("H. configuración de empresa A nunca se devuelve para empresa B", () => {
  const data = bootstrapForCode(
    [ABNET, OTHER],
    [ABNET_SETTINGS, OTHER_SETTINGS],
    "ABNET"
  )
  assert.equal(data.companyId, "co-abnet")
  assert.equal(data.operations.shiftRadiusMeters, 200)
  assert.notEqual(data.operations.shiftRadiusMeters, OTHER_SETTINGS.shift_radius_meters)
  assert.notEqual(
    data.operations.gpsHeartbeatIntervalSeconds,
    OTHER_SETTINGS.gps_heartbeat_interval_seconds
  )
  assert.match(service, /\.eq\("company_id", data\.id\)/)
})

test("I. empresa soft-deleted 404 antes de consultar configuración", () => {
  const data = bootstrapForCode(
    [{ ...ABNET, deleted_at: "2026-01-01T00:00:00Z" }],
    [ABNET_SETTINGS],
    "ABNET"
  )
  assert.equal(data, null)
  const notFoundAt = service.indexOf("COMPANY_NOT_FOUND")
  const settingsAt = service.indexOf('from("company_mobile_settings")')
  const deletedAt = service.indexOf('.is("deleted_at", null)')
  assert.ok(deletedAt < settingsAt)
  assert.ok(notFoundAt < settingsAt)
})

test("J. companyId del cliente no selecciona otra configuración", () => {
  const parsed = validateMobileBootstrapRequest({
    companyCode: "ABNET",
    companyId: "co-other",
  })
  assert.deepEqual(parsed, { companyCode: "abnet" })
  const data = bootstrapForCode(
    [ABNET, OTHER],
    [ABNET_SETTINGS, OTHER_SETTINGS],
    "ABNET"
  )
  assert.equal(data.companyId, "co-abnet")
  assert.notEqual(data.operations.shiftRadiusMeters, 999)
  assert.doesNotMatch(service, /record\.companyId/)
  assert.doesNotMatch(service, /body\.companyId/)
  assert.doesNotMatch(service, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.doesNotMatch(service, /resolveTenantCompanyId/)
})

test("K. valores inválidos no pueden persistirse", () => {
  assert.match(migration, /shift_radius_meters > 0/)
  assert.match(migration, /task_radius_meters > 0/)
  assert.match(migration, /gps_heartbeat_interval_seconds > 0/)
  assert.equal(
    canPersistMobileSettings({ ...ABNET_SETTINGS, shift_radius_meters: 0 }),
    false
  )
  assert.equal(
    canPersistMobileSettings({ ...ABNET_SETTINGS, shift_radius_meters: -1 }),
    false
  )
  assert.equal(
    canPersistMobileSettings({ ...ABNET_SETTINGS, task_radius_meters: 0 }),
    false
  )
  assert.equal(
    canPersistMobileSettings({
      ...ABNET_SETTINGS,
      gps_heartbeat_interval_seconds: 0,
    }),
    false
  )
  assert.equal(
    canPersistMobileSettings({
      ...ABNET_SETTINGS,
      gps_heartbeat_interval_seconds: -15,
    }),
    false
  )
  assert.equal(canPersistMobileSettings(ABNET_SETTINGS), true)
})

test("L. bootstrap sigue funcionando para empresas sin configuración", () => {
  const data = bootstrapForCode([ABNET], [], "abnet")
  assert.equal(data.companyId, "co-abnet")
  assert.equal(data.companyName, "ABNet")
  assert.deepEqual(data.operations, DEFAULT_MOBILE_BOOTSTRAP_OPERATIONS)
  assert.doesNotMatch(service, /\.insert\(/)
  assert.doesNotMatch(service, /\.upsert\(/)
  assert.doesNotMatch(mapper, /\.insert\(/)
})

test("jornada y OT leen company_mobile_settings; presence y geo-utils no", () => {
  assert.match(shiftService, /loadCompanyShiftLocationSettings/)
  assert.match(taskStartService, /loadCompanyTaskLocationSettings/)
  assert.doesNotMatch(geoUtils, /company_mobile_settings/)
  assert.doesNotMatch(presenceSettings, /company_mobile_settings/)
  assert.doesNotMatch(service, /getOperationalPresenceRadiusMeters/)
  assert.doesNotMatch(service, /TASK_START_DISTANCE_ENFORCEMENT/)
  assert.doesNotMatch(service, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(geoUtils, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(geoUtils, /TASK_START_DISTANCE_ENFORCEMENT/)
  assert.match(presenceMigration, /operational_radius_meters integer NOT NULL DEFAULT 150/)
  assert.match(bootstrapTypes, /operations: MobileBootstrapOperations/)
})
