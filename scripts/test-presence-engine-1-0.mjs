/**
 * Presence Engine Backend 1.1 — authority, state machine, Activity bridge contracts.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS,
  PRESENCE_EVENT_IDEMPOTENCY_WINDOW_MS,
  isPresenceEventType,
  isPresenceLocationProvider,
} from "../lib/presence/constants.ts"
import {
  decidePresenceEventType,
  PRESENCE_ZONE_STATES,
  resolvePresenceZoneState,
} from "../lib/presence/presence-state.ts"
import { calculatePresenceDistanceMeters } from "../lib/presence/geo.ts"
import { TASK_START_MAX_DISTANCE_METERS } from "../lib/mobile/v1/tasks/geo-utils.ts"
import { ACTIVITY_ACTIONS } from "../lib/activity-engine/activity-actions.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

test("Presence Engine: operational radius is centralized at 150m", () => {
  assert.equal(DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS, 150)
  assert.notEqual(
    TASK_START_MAX_DISTANCE_METERS,
    DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS
  )
  assert.ok(PRESENCE_EVENT_IDEMPOTENCY_WINDOW_MS < 10_000)
})

test("Presence Engine: event type and provider guards", () => {
  assert.equal(isPresenceEventType("ENTER_RADIUS"), true)
  assert.equal(isPresenceEventType("HEARTBEAT"), true)
  assert.equal(isPresenceEventType("EXIT_RADIUS"), true)
  assert.equal(isPresenceEventType("enter"), false)
  assert.equal(isPresenceLocationProvider("GPS"), true)
  assert.equal(isPresenceLocationProvider("FUSED"), true)
  assert.equal(isPresenceLocationProvider("wifi"), false)
})

test("Presence Engine 1.1: state machine — enter / stay / exit / no double boundary", () => {
  assert.equal(resolvePresenceZoneState(null), PRESENCE_ZONE_STATES.UNKNOWN)
  assert.equal(
    resolvePresenceZoneState("ENTER_RADIUS"),
    PRESENCE_ZONE_STATES.INSIDE_RADIUS
  )
  assert.equal(
    resolvePresenceZoneState("EXIT_RADIUS"),
    PRESENCE_ZONE_STATES.OUTSIDE_RADIUS
  )

  // Ingreso
  assert.equal(
    decidePresenceEventType({
      withinRadius: true,
      zoneState: PRESENCE_ZONE_STATES.UNKNOWN,
    }),
    "ENTER_RADIUS"
  )
  assert.equal(
    decidePresenceEventType({
      withinRadius: true,
      zoneState: PRESENCE_ZONE_STATES.OUTSIDE_RADIUS,
    }),
    "ENTER_RADIUS"
  )

  // Permanencia
  assert.equal(
    decidePresenceEventType({
      withinRadius: true,
      zoneState: PRESENCE_ZONE_STATES.INSIDE_RADIUS,
    }),
    "HEARTBEAT"
  )
  assert.equal(
    decidePresenceEventType({
      withinRadius: false,
      zoneState: PRESENCE_ZONE_STATES.OUTSIDE_RADIUS,
    }),
    "HEARTBEAT"
  )
  assert.equal(
    decidePresenceEventType({
      withinRadius: false,
      zoneState: PRESENCE_ZONE_STATES.UNKNOWN,
    }),
    "HEARTBEAT"
  )

  // Salida solo con evidencia GPS fuera + estado INSIDE
  assert.equal(
    decidePresenceEventType({
      withinRadius: false,
      zoneState: PRESENCE_ZONE_STATES.INSIDE_RADIUS,
    }),
    "EXIT_RADIUS"
  )

  // Nunca dos ENTER / dos EXIT consecutivos (HEARTBEAT en su lugar)
  const afterEnter = decidePresenceEventType({
    withinRadius: true,
    zoneState: PRESENCE_ZONE_STATES.INSIDE_RADIUS,
  })
  assert.equal(afterEnter, "HEARTBEAT")
  const afterExit = decidePresenceEventType({
    withinRadius: false,
    zoneState: PRESENCE_ZONE_STATES.OUTSIDE_RADIUS,
  })
  assert.equal(afterExit, "HEARTBEAT")
})

test("Presence Engine 1.1: distance helper", () => {
  const d = calculatePresenceDistanceMeters(-34.6, -58.4, -34.6, -58.4)
  assert.ok(d < 1)
  const far = calculatePresenceDistanceMeters(-34.6, -58.4, -34.7, -58.4)
  assert.ok(far > 1000)
})

test("Presence Engine 1.1: Activity catalog has ENTER/EXIT only (no HEARTBEAT action)", () => {
  assert.equal(ACTIVITY_ACTIONS.PRESENCE_ENTER_RADIUS, "PRESENCE_ENTER_RADIUS")
  assert.equal(ACTIVITY_ACTIONS.PRESENCE_EXIT_RADIUS, "PRESENCE_EXIT_RADIUS")
  assert.equal(
    Object.values(ACTIVITY_ACTIONS).includes("PRESENCE_HEARTBEAT"),
    false
  )
})

test("Presence Engine 1.1: layered architecture + Activity bridge + mobile route", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/20261113000100_presence_engine_1_0.sql"),
    "utf8"
  )
  const route = readFileSync(
    join(
      root,
      "app/api/mobile/v1/tasks/[taskId]/presence-events/route.ts"
    ),
    "utf8"
  )
  const service = readFileSync(
    join(root, "lib/presence/presence-service.server.ts"),
    "utf8"
  )
  const repository = readFileSync(
    join(root, "lib/presence/repository.server.ts"),
    "utf8"
  )
  const validator = readFileSync(
    join(
      root,
      "lib/mobile/v1/presence/validate-presence-event-request.ts"
    ),
    "utf8"
  )
  const mobileAdapter = readFileSync(
    join(
      root,
      "lib/mobile/v1/presence/register-presence-event-service.ts"
    ),
    "utf8"
  )
  const activityBridge = readFileSync(
    join(root, "lib/presence/register-presence-activity.ts"),
    "utf8"
  )
  const stateMachine = readFileSync(
    join(root, "lib/presence/presence-state.ts"),
    "utf8"
  )
  const startRoute = readFileSync(
    join(root, "app/api/mobile/v1/tasks/[taskId]/start/route.ts"),
    "utf8"
  )
  const submitRoute = readFileSync(
    join(
      root,
      "app/api/mobile/v1/tasks/[taskId]/submit-for-approval/route.ts"
    ),
    "utf8"
  )

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.task_presence_events/)
  assert.match(migration, /operational_radius_meters integer NOT NULL DEFAULT 150/)

  assert.match(route, /registerMobileTaskPresenceEvent/)
  assert.doesNotMatch(route, /\.from\("task_presence_events"\)/)

  assert.match(service, /decidePresenceEventType/)
  assert.match(service, /resolvePresenceTargetCoordinates/)
  assert.match(service, /registerPresenceActivitySafe/)
  assert.match(service, /clientEventType/)
  assert.match(repository, /findLatestBoundaryEvent/)
  assert.match(stateMachine, /INSIDE_RADIUS/)
  assert.match(stateMachine, /OUTSIDE_RADIUS/)

  assert.match(validator, /optional/)
  assert.match(mobileAdapter, /clientEventType/)
  assert.match(mobileAdapter, /presenceService\.registerEvent/)
  assert.match(mobileAdapter, /allowedStatuses: \["en-curso"\]/)

  assert.match(activityBridge, /activity\.record/)
  assert.match(activityBridge, /PRESENCE_ENTER_RADIUS/)
  assert.match(activityBridge, /PRESENCE_EXIT_RADIUS/)
  assert.match(activityBridge, /HEARTBEAT/)
  assert.doesNotMatch(
    activityBridge,
    /activity\.record\(\{[^}]*HEARTBEAT/s
  )

  // Compatibility: existing OT flows untouched.
  assert.match(startRoute, /startMobileTask/)
  assert.doesNotMatch(startRoute, /presence/)
  assert.doesNotMatch(submitRoute, /presence/)
})

test("Presence Engine: geo-utils documents separation from presence radius", () => {
  const geo = readFileSync(
    join(root, "lib/mobile/v1/tasks/geo-utils.ts"),
    "utf8"
  )
  assert.match(geo, /Presence Engine/)
  assert.match(geo, /TASK_START_MAX_DISTANCE_METERS = 50/)
  assert.doesNotMatch(geo, /= 150/)
})
