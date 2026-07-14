import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  evaluateTaskStartDistancePolicy,
  getTaskStartDistanceEnforcementRuntimeSnapshot,
  isTaskStartDistanceEnforcementEnabled,
  TASK_START_DISTANCE_ENFORCEMENT_ENABLED,
  TASK_START_DISTANCE_ENFORCEMENT_ENV,
  TASK_START_MAX_DISTANCE_METERS,
} from "../lib/mobile/v1/tasks/geo-utils.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

const CLIENT = { latitude: -31.4167, longitude: -64.1833 }
const FAR = { latitude: -31.43, longitude: -64.2 }

test("enforcement está desactivado por defecto (sin env)", () => {
  assert.equal(isTaskStartDistanceEnforcementEnabled({}), false)
  assert.equal(
    isTaskStartDistanceEnforcementEnabled({
      [TASK_START_DISTANCE_ENFORCEMENT_ENV]: "",
    }),
    false
  )
  assert.equal(TASK_START_DISTANCE_ENFORCEMENT_ENABLED, false)

  const snapshot = getTaskStartDistanceEnforcementRuntimeSnapshot({})
  assert.equal(snapshot.envPresent, false)
  assert.equal(snapshot.envTruthy, false)
  assert.equal(snapshot.effectiveEnabled, false)
  assert.equal(snapshot.constantDefaultEnabled, false)
})

test("enforcement se puede reactivar por env", () => {
  assert.equal(
    isTaskStartDistanceEnforcementEnabled({
      [TASK_START_DISTANCE_ENFORCEMENT_ENV]: "true",
    }),
    true
  )
  assert.equal(
    isTaskStartDistanceEnforcementEnabled({
      [TASK_START_DISTANCE_ENFORCEMENT_ENV]: "1",
    }),
    true
  )
  assert.equal(
    isTaskStartDistanceEnforcementEnabled({
      [TASK_START_DISTANCE_ENFORCEMENT_ENV]: "false",
    }),
    false
  )
})

test("inicio lejos del punto: no bloquea cuando enforcement está off", () => {
  const result = evaluateTaskStartDistancePolicy({
    operatorLatitude: FAR.latitude,
    operatorLongitude: FAR.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: false,
  })

  assert.equal(result.withinRadius, false)
  assert.ok(result.distanceToClientMeters > TASK_START_MAX_DISTANCE_METERS)
  assert.equal(result.shouldBlock, false)
  assert.equal(result.message, null)
})

test("inicio lejos del punto: bloquea solo con enforcement on", () => {
  const result = evaluateTaskStartDistancePolicy({
    operatorLatitude: FAR.latitude,
    operatorLongitude: FAR.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: true,
  })

  assert.equal(result.shouldBlock, true)
  assert.match(result.message ?? "", /Se encuentra a \d+ metros del domicilio/)
  assert.ok(result.distanceToClientMeters > TASK_START_MAX_DISTANCE_METERS)
})

test("inicio cerca del punto: no bloquea aunque enforcement esté on", () => {
  const result = evaluateTaskStartDistancePolicy({
    operatorLatitude: CLIENT.latitude,
    operatorLongitude: CLIENT.longitude,
    targetLatitude: CLIENT.latitude,
    targetLongitude: CLIENT.longitude,
    enforcementEnabled: true,
  })

  assert.equal(result.withinRadius, true)
  assert.equal(result.shouldBlock, false)
  assert.equal(result.distanceToClientMeters, 0)
})

test("start service usa evaluateTaskStartDistancePolicy (no chequeo hardcodeado)", () => {
  const startService = readFileSync(
    join(__dirname, "../lib/mobile/v1/tasks/task-start-service.ts"),
    "utf8"
  )

  assert.match(startService, /evaluateTaskStartDistancePolicy/)
  assert.match(startService, /distancePolicy\.shouldBlock/)
  assert.match(startService, /TASK_LOCATION_OUT_OF_RANGE/)
  assert.doesNotMatch(
    startService,
    /if \(\s*!isWithinTaskStartRadius/
  )
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
