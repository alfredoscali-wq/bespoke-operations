/**
 * GPS Live 1.0 — last crew position. Source-contract + in-memory policy.
 * Does not hit a live database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { canViewOperationsLiveMap } from "../lib/gps-live/access.ts"
import {
  GPS_HEARTBEAT_INTERVAL_MAX_SECONDS,
  GPS_HEARTBEAT_INTERVAL_MIN_SECONDS,
  GPS_HEARTBEAT_MIN_ACCEPT_GAP_SECONDS,
  GPS_LIVE_MAP_POLL_MS,
} from "../lib/gps-live/constants.ts"
import {
  evaluateGpsLiveHeartbeatGate,
  resolveGpsLiveFreshness,
  upsertGpsLiveLocationRow,
} from "../lib/gps-live/heartbeat-policy.ts"
import { buildOperationsLiveMapCrews } from "../lib/gps-live/live-map-view.ts"
import { parseCompanyGpsSettingsPut } from "../lib/company-gps-settings/validate.ts"
import { MobileApiError } from "../lib/mobile/v1/errors.ts"
import { validateMobileGpsHeartbeatRequest } from "../lib/mobile/v1/gps/validate-gps-heartbeat-request.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const migration = read(
  "supabase/migrations/20261227000100_company_work_team_locations.sql"
)
const heartbeatRoute = read("app/api/mobile/v1/gps/heartbeat/route.ts")
const heartbeatService = read("lib/mobile/v1/gps/gps-heartbeat-service.ts")
const heartbeatValidate = read(
  "lib/mobile/v1/gps/validate-gps-heartbeat-request.ts"
)
const liveMapRoute = read("app/api/operations/live-map/route.ts")
const liveMapService = read("lib/gps-live/live-map-service.server.ts")
const liveMapPage = read("components/operations/operations-live-map-page.tsx")
const liveMapCanvas = read("components/operations/live-map-canvas.tsx")
const presenceRadius = read("lib/presence/operational-radius.server.ts")
const presenceConstants = read("lib/presence/constants.ts")
const docs = read("docs/mobile-api.md")
const gpsReadme = read("app/api/mobile/v1/gps/README.md")

const COMPANY_A = "co-abnet"
const COMPANY_B = "co-other"
const TEAM_A = "team-a"
const TEAM_B = "team-b"
const DEVICE_A = "dev-a"
const NOW = Date.parse("2026-09-16T22:00:00.000Z")

function gpsPut(overrides = {}) {
  return {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 150,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 150,
    gpsHeartbeatEnabled: true,
    gpsHeartbeatIntervalSeconds: 60,
    ...overrides,
  }
}

function heartbeatBody(overrides = {}) {
  return {
    deviceId: "android-1",
    latitude: -31.4201,
    longitude: -64.1888,
    accuracyMeters: 8,
    timestamp: new Date(NOW).toISOString(),
    ...overrides,
  }
}

const REASON_TO_ERROR = {
  device_not_found: { code: "DEVICE_NOT_FOUND", status: 404 },
  device_blocked: { code: "DEVICE_BLOCKED", status: 403 },
  work_team_not_assigned: { code: "WORK_TEAM_NOT_ASSIGNED", status: 409 },
  shift_inactive: { code: "SHIFT_NOT_ACTIVE", status: 409 },
  disabled: { code: "GPS_HEARTBEAT_DISABLED", status: 409 },
  too_frequent: { code: "GPS_HEARTBEAT_TOO_FREQUENT", status: 429 },
}

function locationKey(companyId, workTeamId) {
  return `${companyId}::${workTeamId}`
}

function attemptHeartbeat(input) {
  let request
  try {
    request = validateMobileGpsHeartbeatRequest(input.body, input.nowMs)
  } catch (error) {
    if (error instanceof MobileApiError) {
      return { ok: false, code: error.code, status: error.status }
    }
    throw error
  }

  const store = input.store
  const last = store.get(locationKey(input.authCompanyId, input.device?.workTeamId ?? ""))
  const gate = evaluateGpsLiveHeartbeatGate({
    authCompanyId: input.authCompanyId,
    device: input.device,
    shiftActive: input.shiftActive,
    heartbeatEnabled: input.heartbeatEnabled,
    lastReceivedAt: last?.receivedAt ?? null,
    nowMs: input.nowMs,
  })

  if (!gate.accept) {
    const mapped = REASON_TO_ERROR[gate.reason]
    return { ok: false, ...mapped }
  }

  const row = upsertGpsLiveLocationRow({
    existing: store.get(locationKey(input.authCompanyId, gate.workTeamId)) ?? null,
    companyId: input.authCompanyId,
    workTeamId: gate.workTeamId,
    deviceId: input.device.id,
    latitude: request.latitude,
    longitude: request.longitude,
    accuracyMeters: request.accuracyMeters,
    capturedAt: request.timestamp,
    receivedAt: new Date(input.nowMs).toISOString(),
  })
  store.set(locationKey(row.companyId, row.workTeamId), row)
  return { ok: true, row, created: row.created }
}

test("migración: última posición por cuadrilla, UNIQUE tenant+crew, RLS", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.company_work_team_locations/)
  assert.match(migration, /UNIQUE \(company_id, work_team_id\)/)
  assert.match(migration, /REFERENCES public\.companies/)
  assert.match(migration, /REFERENCES public\.crews/)
  assert.match(migration, /REFERENCES public\.mobile_devices/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /auth_user_company_id\(\)/)
  assert.match(migration, /FOR SELECT/)
  assert.doesNotMatch(migration, /FOR INSERT/)
  assert.doesNotMatch(migration, /FOR UPDATE/)
  assert.match(migration, /GRANT SELECT ON TABLE public\.company_work_team_locations TO authenticated/)
  assert.match(migration, /gps_heartbeat_interval_seconds >= 30/)
  assert.match(migration, /gps_heartbeat_interval_seconds <= 120/)
  assert.doesNotMatch(migration, /task_presence_events/)
  assert.doesNotMatch(migration, /CREATE TABLE .*gps_heartbeat_history/)
})

test("creación de última posición y UPSERT unique company + work_team", () => {
  const store = new Map()
  const first = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW,
    body: heartbeatBody(),
  })
  assert.equal(first.ok, true)
  assert.equal(first.created, true)
  assert.equal(store.size, 1)

  const second = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW + 30_000,
    body: heartbeatBody({
      latitude: -31.43,
      timestamp: new Date(NOW + 30_000).toISOString(),
    }),
  })
  assert.equal(second.ok, true)
  assert.equal(second.created, false)
  assert.equal(store.size, 1)
  assert.equal(second.row.latitude, -31.43)
  assert.equal(second.row.companyId, COMPANY_A)
  assert.equal(second.row.workTeamId, TEAM_A)

  const otherTeam = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: "dev-b",
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_B,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW + 30_000,
    body: heartbeatBody({ deviceId: "android-2" }),
  })
  assert.equal(otherTeam.ok, true)
  assert.equal(store.size, 2)
})

test("aislamiento tenant: companyId del body no escribe otra empresa", () => {
  const store = new Map()
  const result = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW,
    body: heartbeatBody({
      companyId: COMPANY_B,
      workTeamId: TEAM_B,
    }),
  })
  assert.equal(result.ok, true)
  assert.equal(result.row.companyId, COMPANY_A)
  assert.equal(result.row.workTeamId, TEAM_A)
  assert.equal(store.has(locationKey(COMPANY_B, TEAM_B)), false)
  assert.match(heartbeatValidate, /companyId and workTeamId in the body are ignored/)
  assert.doesNotMatch(heartbeatService, /request\.companyId/)
  assert.doesNotMatch(heartbeatService, /request\.workTeamId/)
  assert.match(heartbeatService, /auth\.companyId/)
})

test("dispositivo asociado a cuadrilla; dispositivo de otra empresa se rechaza", () => {
  const store = new Map()
  const unbound = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: null,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW,
    body: heartbeatBody(),
  })
  assert.equal(unbound.ok, false)
  assert.equal(unbound.code, "WORK_TEAM_NOT_ASSIGNED")
  assert.equal(store.size, 0)
  assert.match(heartbeatService, /mobileDevice\.workTeamId/)

  const foreign = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: "dev-other",
      companyId: COMPANY_B,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW,
    body: heartbeatBody(),
  })
  assert.equal(foreign.ok, false)
  assert.equal(foreign.code, "DEVICE_NOT_FOUND")
})

test("jornada ACTIVE acepta; jornada finalizada no actualiza y no es error interno", () => {
  const store = new Map()
  const active = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW,
    body: heartbeatBody(),
  })
  assert.equal(active.ok, true)

  const ended = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: false,
    heartbeatEnabled: true,
    nowMs: NOW + 30_000,
    body: heartbeatBody({
      latitude: -31.5,
      timestamp: new Date(NOW + 30_000).toISOString(),
    }),
  })
  assert.equal(ended.ok, false)
  assert.equal(ended.code, "SHIFT_NOT_ACTIVE")
  assert.equal(ended.status, 409)
  assert.equal(store.get(locationKey(COMPANY_A, TEAM_A)).latitude, -31.4201)
  assert.match(heartbeatService, /SHIFT_NOT_ACTIVE/)
})

test("heartbeat habilitado / deshabilitado", () => {
  const store = new Map()
  const disabled = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: false,
    nowMs: NOW,
    body: heartbeatBody(),
  })
  assert.equal(disabled.ok, false)
  assert.equal(disabled.code, "GPS_HEARTBEAT_DISABLED")
  assert.equal(disabled.status, 409)
  assert.equal(store.size, 0)

  const enabled = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW,
    body: heartbeatBody(),
  })
  assert.equal(enabled.ok, true)
  assert.equal(parseCompanyGpsSettingsPut(gpsPut({ gpsHeartbeatEnabled: false })).ok, true)
  assert.equal(
    parseCompanyGpsSettingsPut(gpsPut({ gpsHeartbeatIntervalSeconds: 29 })).ok,
    false
  )
  assert.equal(
    parseCompanyGpsSettingsPut(gpsPut({ gpsHeartbeatIntervalSeconds: 121 })).ok,
    false
  )
  assert.equal(
    parseCompanyGpsSettingsPut(gpsPut({ gpsHeartbeatIntervalSeconds: 30 })).ok,
    true
  )
  assert.equal(
    parseCompanyGpsSettingsPut(gpsPut({ gpsHeartbeatIntervalSeconds: 120 })).ok,
    true
  )
  assert.equal(GPS_HEARTBEAT_INTERVAL_MIN_SECONDS, 30)
  assert.equal(GPS_HEARTBEAT_INTERVAL_MAX_SECONDS, 120)
})

test("latitude, longitude, accuracy y timestamp inválidos", () => {
  const cases = [
    { latitude: 91 },
    { latitude: -91 },
    { longitude: 181 },
    { longitude: -181 },
    { accuracyMeters: -1 },
    { accuracyMeters: 10001 },
    { timestamp: "no-es-fecha" },
    { timestamp: new Date(NOW + 3 * 60 * 1000).toISOString() },
    { timestamp: new Date(NOW - 25 * 60 * 60 * 1000).toISOString() },
  ]
  for (const overrides of cases) {
    assert.throws(
      () => validateMobileGpsHeartbeatRequest(heartbeatBody(overrides), NOW),
      (error) => error instanceof MobileApiError && error.code === "INVALID_REQUEST"
    )
  }
  assert.doesNotThrow(() =>
    validateMobileGpsHeartbeatRequest(heartbeatBody({ accuracyMeters: null }), NOW)
  )
})

test("anti spam: piso 20 s; intervalos de 30 s se aceptan", () => {
  const store = new Map()
  const first = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW,
    body: heartbeatBody(),
  })
  assert.equal(first.ok, true)

  const tooSoon = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW + 19_000,
    body: heartbeatBody({ timestamp: new Date(NOW + 19_000).toISOString() }),
  })
  assert.equal(tooSoon.ok, false)
  assert.equal(tooSoon.code, "GPS_HEARTBEAT_TOO_FREQUENT")
  assert.equal(tooSoon.status, 429)

  const thirty = attemptHeartbeat({
    store,
    authCompanyId: COMPANY_A,
    device: {
      id: DEVICE_A,
      companyId: COMPANY_A,
      status: "ACTIVE",
      workTeamId: TEAM_A,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    nowMs: NOW + 30_000,
    body: heartbeatBody({ timestamp: new Date(NOW + 30_000).toISOString() }),
  })
  assert.equal(thirty.ok, true)
  assert.equal(GPS_HEARTBEAT_MIN_ACCEPT_GAP_SECONDS, 20)
  assert.doesNotMatch(heartbeatService, /spoof/)
  assert.doesNotMatch(liveMapService, /spoof/)
})

test("GET live-map: autorización y company_id de sesión", () => {
  assert.equal(
    canViewOperationsLiveMap({
      systemRole: "administrador",
      roleCode: "administrador",
      moduleVisibility: { planificacion: false },
    }),
    true
  )
  assert.equal(
    canViewOperationsLiveMap({
      systemRole: "supervisor",
      roleCode: "supervisor",
      moduleVisibility: { planificacion: true },
    }),
    true
  )
  assert.equal(
    canViewOperationsLiveMap({
      systemRole: "operario",
      roleCode: "operario",
      moduleVisibility: { planificacion: false },
    }),
    false
  )
  assert.match(liveMapRoute, /getSessionUser/)
  assert.match(liveMapRoute, /canViewOperationsLiveMap/)
  assert.match(liveMapRoute, /sessionUser\.companyId/)
  assert.doesNotMatch(liveMapRoute, /searchParams/)
  assert.doesNotMatch(liveMapRoute, /body\.companyId/)
  assert.match(liveMapService, /\.eq\("company_id", companyId\)/)
})

test("aislamiento cross tenant en live-map y OT en curso", () => {
  const nowMs = NOW
  const crews = buildOperationsLiveMapCrews({
    shifts: [{ workTeamId: TEAM_A, startedAt: new Date(NOW - 3600_000).toISOString() }],
    crews: [{ id: TEAM_A, name: "Alpha" }],
    locations: [
      {
        workTeamId: TEAM_A,
        latitude: -31.42,
        longitude: -64.18,
        accuracyMeters: 10,
        capturedAt: new Date(NOW - 20_000).toISOString(),
        receivedAt: new Date(NOW - 15_000).toISOString(),
      },
      {
        workTeamId: TEAM_B,
        latitude: -34.6,
        longitude: -58.38,
        accuracyMeters: 5,
        capturedAt: new Date(NOW - 20_000).toISOString(),
        receivedAt: new Date(NOW - 15_000).toISOString(),
      },
    ],
    tasks: [
      {
        id: "ot-1",
        code: "OT-100",
        title: "Instalación",
        status: "en-curso",
        crewId: TEAM_A,
        crew: "Alpha",
        latitude: -31.41,
        longitude: -64.17,
        projectId: null,
      },
    ],
    projectGpsById: new Map(),
    intervalSeconds: 60,
    nowMs,
  })
  assert.equal(crews.length, 1)
  assert.equal(crews[0].workTeamId, TEAM_A)
  assert.equal(crews[0].currentTask?.code, "OT-100")
  assert.equal(crews[0].currentTask?.destination?.latitude, -31.41)
  assert.equal(crews[0].freshness, "recent")
  assert.doesNotMatch(liveMapService, /national_id/)
  assert.doesNotMatch(liveMapService, /employee_id/)
})

test("posición desactualizada vs reciente vs sin posición", () => {
  const interval = 60
  assert.equal(
    resolveGpsLiveFreshness({
      capturedAt: new Date(NOW - 20_000).toISOString(),
      receivedAt: new Date(NOW - 10_000).toISOString(),
      intervalSeconds: interval,
      nowMs: NOW,
    }),
    "recent"
  )
  assert.equal(
    resolveGpsLiveFreshness({
      capturedAt: new Date(NOW - 4 * 60 * 1000).toISOString(),
      receivedAt: new Date(NOW - 10_000).toISOString(),
      intervalSeconds: interval,
      nowMs: NOW,
    }),
    "stale"
  )
  assert.equal(
    resolveGpsLiveFreshness({
      capturedAt: null,
      receivedAt: null,
      intervalSeconds: interval,
      nowMs: NOW,
    }),
    "missing"
  )
  const missing = buildOperationsLiveMapCrews({
    shifts: [{ workTeamId: TEAM_A, startedAt: new Date(NOW).toISOString() }],
    crews: [{ id: TEAM_A, name: "Alpha" }],
    locations: [],
    tasks: [],
    projectGpsById: new Map(),
    intervalSeconds: 60,
    nowMs: NOW,
  })
  assert.equal(missing[0].freshness, "missing")
  assert.equal(missing[0].latitude, null)
})

test("mapa operativo Leaflet, polling 30 s, sin Realtime ni Presence", () => {
  assert.match(liveMapPage, /\/api\/operations\/live-map/)
  assert.match(liveMapPage, /GPS_LIVE_MAP_POLL_MS/)
  assert.match(liveMapCanvas, /from "leaflet"/)
  assert.match(liveMapCanvas, /planning-map-tiles/)
  assert.equal(GPS_LIVE_MAP_POLL_MS, 30_000)
  assert.doesNotMatch(liveMapPage, /realtime/i)
  assert.doesNotMatch(liveMapService, /channel\(/)
  assert.doesNotMatch(liveMapService, /task_presence_events/)
  assert.doesNotMatch(heartbeatService, /task_presence_events/)
  assert.doesNotMatch(heartbeatRoute, /task_presence_events/)
  assert.match(presenceConstants, /DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS/)
  assert.match(presenceRadius, /presence_engine_settings/)
  assert.match(docs, /POST \/api\/mobile\/v1\/gps\/heartbeat/)
  assert.match(gpsReadme, /placeholder/i)
  assert.match(heartbeatRoute, /registerMobileGpsHeartbeat/)
  assert.match(heartbeatRoute, /handleProtectedMobileRoute/)
})
