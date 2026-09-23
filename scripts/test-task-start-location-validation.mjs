/**
 * Bespoke Mobile — GPS validation on POST /api/mobile/v1/tasks/:id/start.
 * Source-contract + in-memory policy. Does not hit a live database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { MobileApiError } from "../lib/mobile/v1/errors.ts"
import {
  calculateDistanceMeters,
  evaluateTaskStartDistancePolicy,
} from "../lib/mobile/v1/tasks/geo-utils.ts"
import {
  DEFAULT_TASK_LOCATION_VALIDATION_ENABLED,
  DEFAULT_TASK_RADIUS_METERS,
  mapCompanyTaskLocationSettings,
} from "../lib/mobile/v1/tasks/task-location-validation.ts"
import {
  buildTaskStartLocationRequiredMessage,
  resolveTaskStartCoordinatesFromSources,
} from "../lib/mobile/v1/tasks/task-start-coordinates.ts"
import { validateMobileTaskStartRequest } from "../lib/mobile/v1/tasks/validate-task-start-request.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const startService = read("lib/mobile/v1/tasks/task-start-service.ts")
const loader = read("lib/mobile/v1/tasks/task-start-location.server.ts")
const validate = read("lib/mobile/v1/tasks/validate-task-start-request.ts")
const geoUtils = read("lib/mobile/v1/tasks/geo-utils.ts")
const shiftService = read("lib/mobile/v1/shifts/shift-service.ts")
const shiftPolicy = read("lib/mobile/v1/shifts/shift-location-validation.ts")

const CLIENT = { latitude: -31.4167, longitude: -64.1833 }
const NEAR = { latitude: -31.41675, longitude: -64.18335 }
const FAR = { latitude: -31.43, longitude: -64.2 }
const MID = { latitude: -31.4173, longitude: -64.1833 }

const COMPANY_A = "co-a"
const COMPANY_B = "co-b"

function settingsForCompany(rows, companyId) {
  return mapCompanyTaskLocationSettings(
    rows.find((row) => row.company_id === companyId) ?? null
  )
}

function tryStartTask(input) {
  if (input.shiftActive === false) {
    return {
      started: false,
      inserted: false,
      code: "SHIFT_NOT_ACTIVE",
      message: "No hay jornada activa.",
      source: null,
    }
  }

  if (input.crewMatches === false) {
    return {
      started: false,
      inserted: false,
      code: "TASK_NOT_FOUND",
      message: "Orden de trabajo no encontrada.",
      source: null,
    }
  }

  if (input.dateRangeActive === false) {
    return {
      started: false,
      inserted: false,
      code: "TASK_NOT_FOUND",
      message: "Orden de trabajo no encontrada.",
      source: null,
    }
  }

  if (input.taskStatus && input.taskStatus !== "asignada") {
    return {
      started: false,
      inserted: false,
      code: "TASK_INVALID_STATUS",
      message: "La orden de trabajo no puede iniciarse en su estado actual.",
      source: null,
    }
  }

  const settings = settingsForCompany(input.settingsRows, input.authCompanyId)

  if (!settings.taskLocationValidationEnabled) {
    return {
      started: true,
      inserted: true,
      code: null,
      source: null,
      policy: {
        shouldBlock: false,
        enforcementEnabled: false,
      },
    }
  }

  const coords = resolveTaskStartCoordinatesFromSources({
    task: input.task,
    project: input.project ?? null,
  })
  if (!coords) {
    return {
      started: false,
      inserted: false,
      code: "TASK_LOCATION_REQUIRED",
      message: buildTaskStartLocationRequiredMessage(Boolean(input.task.projectId)),
      source: null,
    }
  }

  const policy = evaluateTaskStartDistancePolicy({
    operatorLatitude: input.device.latitude,
    operatorLongitude: input.device.longitude,
    targetLatitude: coords.latitude,
    targetLongitude: coords.longitude,
    enforcementEnabled: settings.taskLocationValidationEnabled,
    maxDistanceMeters: settings.taskRadiusMeters,
  })

  if (policy.shouldBlock) {
    return {
      started: false,
      inserted: false,
      code: "TASK_LOCATION_OUT_OF_RANGE",
      message: policy.message,
      source: coords.source,
      policy,
    }
  }

  return {
    started: true,
    inserted: true,
    code: null,
    source: coords.source,
    policy,
  }
}

const SETTINGS_A_OFF = {
  company_id: COMPANY_A,
  task_location_validation_enabled: false,
  task_radius_meters: 150,
}

const SETTINGS_A_ON_150 = {
  company_id: COMPANY_A,
  task_location_validation_enabled: true,
  task_radius_meters: 150,
}

const SETTINGS_A_ON_50 = {
  company_id: COMPANY_A,
  task_location_validation_enabled: true,
  task_radius_meters: 50,
}

const SETTINGS_B_ON_50 = {
  company_id: COMPANY_B,
  task_location_validation_enabled: true,
  task_radius_meters: 50,
}

const NORMAL_OT = {
  projectId: null,
  latitude: CLIENT.latitude,
  longitude: CLIENT.longitude,
}

test("A. validation OFF → inicio funciona como antes (lejos no bloquea)", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_OFF],
    device: FAR,
    task: NORMAL_OT,
  })
  assert.equal(result.started, true)
  assert.equal(result.inserted, true)
  assert.equal(result.policy.shouldBlock, false)
  assert.equal(DEFAULT_TASK_LOCATION_VALIDATION_ENABLED, false)
})

test("B. validation ON + OT normal + dentro del radio → inicia", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    task: NORMAL_OT,
  })
  assert.equal(result.started, true)
  assert.equal(result.source, "task")
  assert.equal(result.policy.withinRadius, true)
})

test("C. validation ON + OT normal + exactamente en el límite → inicia", () => {
  const distance = calculateDistanceMeters(
    NEAR.latitude,
    NEAR.longitude,
    CLIENT.latitude,
    CLIENT.longitude
  )
  const policy = evaluateTaskStartDistancePolicy({
    operatorLatitude: NEAR.latitude,
    operatorLongitude: NEAR.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: true,
    maxDistanceMeters: distance,
  })
  assert.equal(policy.shouldBlock, false)
  assert.equal(policy.withinRadius, true)
})

test("D. validation ON + OT normal + fuera del radio → 409", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: FAR,
    task: NORMAL_OT,
  })
  assert.equal(result.started, false)
  assert.equal(result.code, "TASK_LOCATION_OUT_OF_RANGE")
  assert.match(result.message ?? "", /Se encuentra a \d+ metros del domicilio/)
  assert.match(startService, /TASK_LOCATION_OUT_OF_RANGE/)
  assert.match(startService, /,\s*409/)
})

test("E. empresa con radio 50 m utiliza 50 m", () => {
  const distance = calculateDistanceMeters(
    MID.latitude,
    MID.longitude,
    CLIENT.latitude,
    CLIENT.longitude
  )
  assert.ok(distance > 50)
  assert.ok(distance < 150)
  const with50 = evaluateTaskStartDistancePolicy({
    operatorLatitude: MID.latitude,
    operatorLongitude: MID.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: true,
    maxDistanceMeters: 50,
  })
  assert.equal(with50.shouldBlock, true)
})

test("F. empresa con radio 150 m utiliza 150 m", () => {
  const with150 = evaluateTaskStartDistancePolicy({
    operatorLatitude: MID.latitude,
    operatorLongitude: MID.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: true,
    maxDistanceMeters: 150,
  })
  assert.equal(with150.shouldBlock, false)
  assert.equal(
    settingsForCompany([SETTINGS_A_ON_150], COMPANY_A).taskRadiusMeters,
    150
  )
  assert.equal(DEFAULT_TASK_RADIUS_METERS, 150)
})

test("G. empresa A no puede usar configuración de empresa B", () => {
  assert.equal(
    settingsForCompany([SETTINGS_A_ON_150, SETTINGS_B_ON_50], COMPANY_A)
      .taskRadiusMeters,
    150
  )
  assert.equal(
    settingsForCompany([SETTINGS_A_ON_150, SETTINGS_B_ON_50], COMPANY_B)
      .taskRadiusMeters,
    50
  )
  assert.match(loader, /\.eq\("company_id", companyId\)/)
  assert.match(startService, /loadCompanyTaskLocationSettings\(admin, auth\.companyId\)/)
  assert.match(startService, /resolveTaskStartCoordinates\(\s*admin,\s*auth\.companyId/)
})

test("H. validation ON + sin coordenadas de referencia → TASK_LOCATION_REQUIRED", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    task: { projectId: null, latitude: null, longitude: null },
  })
  assert.equal(result.started, false)
  assert.equal(result.inserted, false)
  assert.equal(result.code, "TASK_LOCATION_REQUIRED")
  assert.equal(
    result.message,
    "La orden de trabajo no tiene ubicación registrada."
  )
})

test("I. coordenadas del dispositivo inválidas → INVALID_REQUEST", () => {
  assert.throws(
    () =>
      validateMobileTaskStartRequest({
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
      validateMobileTaskStartRequest({
        deviceId: "dev-1",
        latitude: -31.42,
        longitude: 181,
      }),
    (error) =>
      error instanceof MobileApiError && error.code === "INVALID_REQUEST"
  )
  assert.match(validate, /hasCoordinates/)
})

test("J. rechazo por distancia NO crea task_execution_starts", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_50],
    device: FAR,
    task: NORMAL_OT,
  })
  assert.equal(result.inserted, false)
  const blockAt = startService.indexOf("distancePolicy.shouldBlock")
  const insertCallAt = startService.lastIndexOf("insertTaskExecutionStart")
  const updateAt = startService.indexOf('.update({ status: "en-curso" })')
  assert.ok(blockAt > 0)
  assert.ok(insertCallAt > blockAt)
  assert.ok(updateAt > blockAt)
})

test("K. OT de una Obra usa GPS del proyecto cuando la OT no tiene GPS propio", () => {
  const coords = resolveTaskStartCoordinatesFromSources({
    task: { projectId: "proj-1", latitude: null, longitude: null },
    project: { latitude: CLIENT.latitude, longitude: CLIENT.longitude },
  })
  assert.equal(coords?.source, "project")
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    task: { projectId: "proj-1", latitude: null, longitude: null },
    project: { latitude: CLIENT.latitude, longitude: CLIENT.longitude },
  })
  assert.equal(result.started, true)
  assert.equal(result.source, "project")
})

test("L. OT de una Obra sin GPS de proyecto → TASK_LOCATION_REQUIRED cuando ON", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    task: { projectId: "proj-1", latitude: null, longitude: null },
    project: { latitude: null, longitude: null },
  })
  assert.equal(result.started, false)
  assert.equal(result.code, "TASK_LOCATION_REQUIRED")
  assert.equal(
    result.message,
    "La OT y la Obra no tienen ubicación GPS registrada."
  )
})

test("M. companyId enviado por cliente no puede cambiar el tenant", () => {
  const parsed = validateMobileTaskStartRequest({
    deviceId: "dev-1",
    latitude: CLIENT.latitude,
    longitude: CLIENT.longitude,
    companyId: COMPANY_B,
  })
  assert.equal(parsed.deviceId, "dev-1")
  assert.doesNotMatch(validate, /companyId/)
  assert.doesNotMatch(startService, /request\.companyId/)
  assert.doesNotMatch(loader, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.doesNotMatch(startService, /resolveTenantCompanyId/)
})

test("N. empresa sin settings mantiene validation OFF", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [],
    device: FAR,
    task: NORMAL_OT,
  })
  assert.equal(result.started, true)
  assert.deepEqual(mapCompanyTaskLocationSettings(null), {
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 150,
  })
  assert.doesNotMatch(loader, /\.insert\(/)
})

test("O. empresa con configuración explícita no usa el kill-switch global", () => {
  assert.match(
    startService,
    /enforcementEnabled: settings\.taskLocationValidationEnabled/
  )
  assert.match(startService, /maxDistanceMeters: settings\.taskRadiusMeters/)
  assert.doesNotMatch(startService, /isTaskStartDistanceEnforcementEnabled/)
  assert.doesNotMatch(startService, /getTaskStartDistanceEnforcementRuntimeSnapshot/)
  assert.doesNotMatch(startService, /TASK_START_DISTANCE_ENFORCEMENT/)
  assert.doesNotMatch(startService, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(geoUtils, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(geoUtils, /TASK_START_DISTANCE_ENFORCEMENT/)
  assert.doesNotMatch(geoUtils, /process\.env/)
})

test("jornada, heartbeat y modelo de Obras no se tocan en este sprint", () => {
  assert.doesNotMatch(startService, /shift_location_validation_enabled/)
  assert.doesNotMatch(startService, /loadCompanyShiftLocationSettings/)
  assert.match(shiftService, /evaluateShiftStartLocationPolicy/)
  assert.match(shiftPolicy, /DEFAULT_SHIFT_LOCATION_VALIDATION_ENABLED/)
  assert.doesNotMatch(startService, /presence_engine_settings/)
  assert.match(loader, /from\("company_mobile_settings"\)/)
  assert.doesNotMatch(loader, /from\("projects"\)/)
})

const DOROTEA_OT = {
  projectId: "9d66e4ed-6625-4a76-9854-471074232ddf",
  latitude: null,
  longitude: null,
}

const DOROTEA_PROJECT = { latitude: null, longitude: null }

test("1. GPS OFF + OT sin GPS + Obra sin GPS → START permitido", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_OFF],
    device: FAR,
    task: DOROTEA_OT,
    project: DOROTEA_PROJECT,
    taskStatus: "asignada",
    shiftActive: true,
    crewMatches: true,
    dateRangeActive: true,
  })
  assert.equal(result.started, true)
  assert.equal(result.inserted, true)
  assert.equal(result.code, null)
})

test("2. GPS OFF + OT sin GPS + Obra con GPS → START permitido", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_OFF],
    device: FAR,
    task: DOROTEA_OT,
    project: { latitude: CLIENT.latitude, longitude: CLIENT.longitude },
  })
  assert.equal(result.started, true)
  assert.equal(result.code, null)
})

test("3. GPS ON + OT sin GPS + Obra sin GPS → TASK_LOCATION_REQUIRED", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    task: DOROTEA_OT,
    project: DOROTEA_PROJECT,
  })
  assert.equal(result.started, false)
  assert.equal(result.code, "TASK_LOCATION_REQUIRED")
  assert.equal(
    result.message,
    "La OT y la Obra no tienen ubicación GPS registrada."
  )
  assert.match(startService, /TASK_LOCATION_REQUIRED/)
  assert.match(startService, /buildTaskStartLocationRequiredMessage/)
})

test("4. GPS ON + OT con GPS + dispositivo dentro del radio → START permitido", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: NEAR,
    task: NORMAL_OT,
  })
  assert.equal(result.started, true)
  assert.equal(result.source, "task")
  assert.equal(result.policy.withinRadius, true)
})

test("5. GPS ON + OT/Obra con GPS + dispositivo fuera del radio → TASK_LOCATION_OUT_OF_RANGE", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [SETTINGS_A_ON_150],
    device: FAR,
    task: NORMAL_OT,
  })
  assert.equal(result.started, false)
  assert.equal(result.code, "TASK_LOCATION_OUT_OF_RANGE")
  assert.match(result.message ?? "", /Se encuentra a \d+ metros del domicilio/)
})

test("6. GPS OFF no saltea jornada, cuadrilla, fecha ni status", () => {
  assert.equal(
    tryStartTask({
      authCompanyId: COMPANY_A,
      settingsRows: [SETTINGS_A_OFF],
      device: NEAR,
      task: DOROTEA_OT,
      project: DOROTEA_PROJECT,
      shiftActive: false,
    }).code,
    "SHIFT_NOT_ACTIVE"
  )
  assert.equal(
    tryStartTask({
      authCompanyId: COMPANY_A,
      settingsRows: [SETTINGS_A_OFF],
      device: NEAR,
      task: DOROTEA_OT,
      crewMatches: false,
    }).code,
    "TASK_NOT_FOUND"
  )
  assert.equal(
    tryStartTask({
      authCompanyId: COMPANY_A,
      settingsRows: [SETTINGS_A_OFF],
      device: NEAR,
      task: DOROTEA_OT,
      dateRangeActive: false,
    }).code,
    "TASK_NOT_FOUND"
  )
  assert.equal(
    tryStartTask({
      authCompanyId: COMPANY_A,
      settingsRows: [SETTINGS_A_OFF],
      device: NEAR,
      task: DOROTEA_OT,
      taskStatus: "programada",
    }).code,
    "TASK_INVALID_STATUS"
  )

  const shiftAt = startService.indexOf("SHIFT_NOT_ACTIVE")
  const statusAt = startService.indexOf("TASK_INVALID_STATUS")
  const crewAt = startService.indexOf("taskMatchesCrewId")
  const dateAt = startService.indexOf("isOperationalDateRangeActive")
  const gpsAt = startService.indexOf("TASK_LOCATION_REQUIRED")
  assert.ok(shiftAt > 0 && shiftAt < gpsAt)
  assert.ok(statusAt > 0 && statusAt < gpsAt)
  assert.ok(crewAt > 0 && crewAt < gpsAt)
  assert.ok(dateAt > 0 && dateAt < gpsAt)
})

test("producción FO-DOR: ABNet GPS OFF + TSK-FODOR-002 sin coords → puede iniciar", () => {
  const result = tryStartTask({
    authCompanyId: COMPANY_A,
    settingsRows: [
      {
        company_id: COMPANY_A,
        task_location_validation_enabled: false,
        task_radius_meters: 150,
      },
    ],
    device: FAR,
    task: {
      projectId: "9d66e4ed-6625-4a76-9854-471074232ddf",
      latitude: null,
      longitude: null,
    },
    project: { latitude: null, longitude: null },
    taskStatus: "asignada",
    shiftActive: true,
    crewMatches: true,
    dateRangeActive: true,
  })
  assert.equal(result.started, true)
  assert.equal(result.code, null)

  const settingsLoadAt = startService.indexOf("loadCompanyTaskLocationSettings")
  const requiredAt = startService.indexOf("TASK_LOCATION_REQUIRED")
  assert.ok(settingsLoadAt > 0 && settingsLoadAt < requiredAt)
  assert.match(
    startService,
    /if \(settings\.taskLocationValidationEnabled\)/
  )
})
