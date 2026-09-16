import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { evaluateTaskStartDistancePolicy } from "../lib/mobile/v1/tasks/geo-utils.ts"
import { DEFAULT_TASK_RADIUS_METERS } from "../lib/mobile/v1/tasks/task-location-validation.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

const CLIENT = { latitude: -31.4167, longitude: -64.1833 }
const FAR = { latitude: -31.43, longitude: -64.2 }

test("el radio tenant es la única fuente; env global no habilita el bloqueo", () => {
  const previous = process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED
  process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED = "true"
  const result = evaluateTaskStartDistancePolicy({
    operatorLatitude: FAR.latitude,
    operatorLongitude: FAR.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: false,
    maxDistanceMeters: DEFAULT_TASK_RADIUS_METERS,
  })
  if (previous == null) {
    delete process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED
  } else {
    process.env.TASK_START_DISTANCE_ENFORCEMENT_ENABLED = previous
  }

  assert.equal(result.shouldBlock, false)
  assert.equal(result.enforcementEnabled, false)
  assert.equal(DEFAULT_TASK_RADIUS_METERS, 150)
})

test("inicio lejos del punto: no bloquea cuando el flag tenant está off", () => {
  const result = evaluateTaskStartDistancePolicy({
    operatorLatitude: FAR.latitude,
    operatorLongitude: FAR.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: false,
    maxDistanceMeters: DEFAULT_TASK_RADIUS_METERS,
  })

  assert.equal(result.withinRadius, false)
  assert.ok(result.distanceToClientMeters > DEFAULT_TASK_RADIUS_METERS)
  assert.equal(result.shouldBlock, false)
  assert.equal(result.message, null)
})

test("inicio lejos del punto: bloquea solo con flag tenant on", () => {
  const result = evaluateTaskStartDistancePolicy({
    operatorLatitude: FAR.latitude,
    operatorLongitude: FAR.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: true,
    maxDistanceMeters: DEFAULT_TASK_RADIUS_METERS,
  })

  assert.equal(result.shouldBlock, true)
  assert.match(result.message ?? "", /Se encuentra a \d+ metros del domicilio/)
  assert.ok(result.distanceToClientMeters > DEFAULT_TASK_RADIUS_METERS)
})

test("inicio cerca del punto: no bloquea aunque el flag tenant esté on", () => {
  const result = evaluateTaskStartDistancePolicy({
    operatorLatitude: CLIENT.latitude,
    operatorLongitude: CLIENT.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: true,
    maxDistanceMeters: DEFAULT_TASK_RADIUS_METERS,
  })

  assert.equal(result.withinRadius, true)
  assert.equal(result.shouldBlock, false)
  assert.equal(result.distanceToClientMeters, 0)
})

test("radio 50 m no sustituye al radio tenant 150 m", () => {
  const mid = {
    operatorLatitude: -31.4173,
    operatorLongitude: -64.1833,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
  }
  const legacy50 = evaluateTaskStartDistancePolicy({
    ...mid,
    enforcementEnabled: true,
    maxDistanceMeters: 50,
  })
  const tenant150 = evaluateTaskStartDistancePolicy({
    ...mid,
    enforcementEnabled: true,
    maxDistanceMeters: DEFAULT_TASK_RADIUS_METERS,
  })
  assert.equal(legacy50.shouldBlock, true)
  assert.equal(tenant150.shouldBlock, false)
})

test("start service usa evaluateTaskStartDistancePolicy con settings tenant", () => {
  const startService = readFileSync(
    join(__dirname, "../lib/mobile/v1/tasks/task-start-service.ts"),
    "utf8"
  )
  const geoUtils = readFileSync(
    join(__dirname, "../lib/mobile/v1/tasks/geo-utils.ts"),
    "utf8"
  )

  assert.match(startService, /evaluateTaskStartDistancePolicy/)
  assert.match(startService, /distancePolicy\.shouldBlock/)
  assert.match(startService, /TASK_LOCATION_OUT_OF_RANGE/)
  assert.match(
    startService,
    /enforcementEnabled: settings\.taskLocationValidationEnabled/
  )
  assert.match(startService, /maxDistanceMeters: settings\.taskRadiusMeters/)
  assert.doesNotMatch(startService, /if \(\s*!isWithinTaskStartRadius/)
  assert.doesNotMatch(geoUtils, /TASK_START_MAX_DISTANCE_METERS/)
  assert.doesNotMatch(geoUtils, /TASK_START_DISTANCE_ENFORCEMENT/)
})

test("ruta start sigue delegando en startMobileTask", () => {
  const route = readFileSync(
    join(
      __dirname,
      "../app/api/mobile/v1/tasks/[taskId]/start/route.ts"
    ),
    "utf8"
  )

  assert.match(route, /startMobileTask/)
  assert.doesNotMatch(route, /TASK_LOCATION_OUT_OF_RANGE/)
})
