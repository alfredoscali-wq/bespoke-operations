import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTaskCrewChangeMetadata,
  buildTaskPriorityChangeMetadata,
  buildTaskRescheduleMetadata,
  buildTaskStartMetadata,
  mapWorkflowActionToActivityEmissions,
  planTaskActivityEmissions,
} from "../lib/activity/adapters/tasks-activity.ts"
import { ACTIVITY_ACTIONS, ACTIVITY_ORIGINS } from "../lib/activity/types.ts"

function baseTask(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    code: "OT-100",
    title: "Instalación",
    status: "programada",
    priority: "media",
    estimatedDuration: "2h",
    dueDate: "2026-07-22",
    scheduledTime: "09:00",
    crewId: "22222222-2222-4222-8222-222222222222",
    crew: "Cuadrilla A",
    latitude: -34.6,
    longitude: -58.4,
    taskMetadata: {},
    ...overrides,
  }
}

test("creación OT → TASK_CREATE / TASK_SCHEDULE catalog anchors", () => {
  const meta = buildTaskStartMetadata({
    previousStatus: "asignada",
    newStatus: "en-curso",
    origin: ACTIVITY_ORIGINS.WEB,
  })
  assert.equal(meta.previousStatus, "asignada")
  assert.equal(meta.newStatus, "en-curso")
  assert.equal(meta.origin, "web")
  assert.equal(ACTIVITY_ACTIONS.TASK_CREATE, "TASK_CREATE")
  assert.equal(ACTIVITY_ACTIONS.TASK_SCHEDULE, "TASK_SCHEDULE")
})

test("edición genérica → TASK_UPDATE", () => {
  const before = /** @type {any} */ (baseTask())
  const after = /** @type {any} */ (baseTask({ title: "Instalación FTTH" }))
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: { title: "Instalación FTTH" },
  })
  assert.equal(planned.emissions.length, 1)
  assert.equal(planned.emissions[0].action, "TASK_UPDATE")
  assert.ok(planned.correlationId)
})

test("cambio cuadrilla → TASK_ASSIGN_CREW con old/new", () => {
  const before = /** @type {any} */ (baseTask())
  const after = /** @type {any} */ (
    baseTask({
      crewId: "33333333-3333-4333-8333-333333333333",
      crew: "Cuadrilla B",
    })
  )
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: {
      crewId: after.crewId,
      crew: after.crew,
    },
  })
  assert.equal(planned.emissions[0].action, "TASK_ASSIGN_CREW")
  assert.deepEqual(
    buildTaskCrewChangeMetadata(before, after),
    planned.emissions[0].metadata
  )
})

test("desasignar cuadrilla → TASK_UNASSIGN_CREW", () => {
  const before = /** @type {any} */ (baseTask())
  const after = /** @type {any} */ (baseTask({ crewId: null, crew: "" }))
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: { crewId: null, crew: "" },
  })
  assert.equal(planned.emissions[0].action, "TASK_UNASSIGN_CREW")
})

test("reprogramación → TASK_RESCHEDULE con fechas", () => {
  const before = /** @type {any} */ (baseTask())
  const after = /** @type {any} */ (
    baseTask({ dueDate: "2026-07-23", scheduledTime: "11:00" })
  )
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: { dueDate: "2026-07-23", scheduledTime: "11:00" },
  })
  assert.equal(planned.emissions[0].action, "TASK_RESCHEDULE")
  assert.deepEqual(
    buildTaskRescheduleMetadata(before, after),
    planned.emissions[0].metadata
  )
})

test("cambio prioridad → TASK_PRIORITY_CHANGE", () => {
  const before = /** @type {any} */ (baseTask())
  const after = /** @type {any} */ (baseTask({ priority: "alta" }))
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: { priority: "alta" },
  })
  assert.equal(planned.emissions[0].action, "TASK_PRIORITY_CHANGE")
  assert.deepEqual(
    buildTaskPriorityChangeMetadata(before, after),
    planned.emissions[0].metadata
  )
})

test("batch planificación: crew + schedule + priority comparten correlation_id", () => {
  const before = /** @type {any} */ (baseTask())
  const after = /** @type {any} */ (
    baseTask({
      crew: "Cuadrilla B",
      crewId: "33333333-3333-4333-8333-333333333333",
      dueDate: "2026-07-24",
      scheduledTime: "14:00",
      priority: "alta",
    })
  )
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: {
      crewId: after.crewId,
      crew: after.crew,
      dueDate: after.dueDate,
      scheduledTime: after.scheduledTime,
      priority: after.priority,
    },
  })
  assert.ok(planned.emissions.length >= 3)
  const actions = planned.emissions.map((e) => e.action)
  assert.ok(actions.includes("TASK_ASSIGN_CREW"))
  assert.ok(actions.includes("TASK_RESCHEDULE"))
  assert.ok(actions.includes("TASK_PRIORITY_CHANGE"))
  assert.equal(
    new Set(planned.emissions.map(() => planned.correlationId)).size,
    1
  )
})

test("inicio OT workflow → TASK_START con geo OIE (no GPS duplicado en metadata)", () => {
  const before = /** @type {any} */ (baseTask({ status: "asignada" }))
  const after = /** @type {any} */ (baseTask({ status: "en-curso" }))
  const emissions = mapWorkflowActionToActivityEmissions("start", before, after)
  assert.equal(emissions[0].action, "TASK_START")
  assert.equal(emissions[0].geo?.latitude, -34.6)
  assert.equal(emissions[0].geo?.longitude, -58.4)
  assert.equal(emissions[0].metadata.previousStatus, "asignada")
  assert.equal(emissions[0].metadata.newStatus, "en-curso")
  assert.equal(emissions[0].metadata.latitude, undefined)
})

test("aprobación / cancelación / rechazo", () => {
  const before = /** @type {any} */ (baseTask({ status: "pendiente-cierre" }))
  const approved = /** @type {any} */ (baseTask({ status: "finalizada" }))
  const rejected = /** @type {any} */ (baseTask({ status: "en-curso" }))
  const cancelled = /** @type {any} */ (baseTask({ status: "cancelada" }))

  const approveEmission = mapWorkflowActionToActivityEmissions(
    "approve",
    before,
    approved
  )[0]
  assert.equal(approveEmission.action, "TASK_APPROVE")
  assert.equal(approveEmission.result, "SUCCESS")
  assert.equal(
    mapWorkflowActionToActivityEmissions("reject", before, rejected)[0].action,
    "TASK_REJECT"
  )
  assert.equal(
    mapWorkflowActionToActivityEmissions("cancel", before, cancelled)[0]
      .result,
    "CANCELLED"
  )
})

test("confirmación planificación workflow → PLANNING_CONFIRM", () => {
  const before = /** @type {any} */ (baseTask({ status: "programada" }))
  const after = /** @type {any} */ (baseTask({ status: "asignada" }))
  const emissions = mapWorkflowActionToActivityEmissions(
    "confirm-planning",
    before,
    after
  )
  assert.equal(emissions[0].action, "PLANNING_CONFIRM")
  assert.equal(emissions[0].module, "planning")
})

test("orden de ejecución → PLANNING_ORDER_CHANGE", () => {
  const before = /** @type {any} */ (baseTask({ executionOrder: 1 }))
  const after = /** @type {any} */ (baseTask({ executionOrder: 3 }))
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: { executionOrder: 3 },
  })
  assert.equal(planned.emissions[0].action, "PLANNING_ORDER_CHANGE")
  assert.equal(planned.emissions[0].metadata.oldOrder, 1)
  assert.equal(planned.emissions[0].metadata.newOrder, 3)
})

test("cambio materialesNeeded → TASK_MATERIALS_CHANGE", () => {
  const before = /** @type {any} */ (
    baseTask({ taskMetadata: { materialsNeeded: "Cable" } })
  )
  const after = /** @type {any} */ (
    baseTask({ taskMetadata: { materialsNeeded: "Cable + conector" } })
  )
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: {
      taskMetadata: { materialsNeeded: "Cable + conector" },
    },
  })
  assert.equal(planned.emissions[0].action, "TASK_MATERIALS_CHANGE")
  assert.equal(planned.emissions[0].metadata.oldMaterials, "Cable")
  assert.equal(planned.emissions[0].metadata.newMaterials, "Cable + conector")
})

test("PROJECT_START / severities catalog anchors", () => {
  assert.equal(ACTIVITY_ACTIONS.PROJECT_START, "PROJECT_START")
  assert.equal(ACTIVITY_ACTIONS.TASK_FORCE_DELETE, "TASK_FORCE_DELETE")
  assert.equal(
    ACTIVITY_ACTIONS.TASK_REFERENCE_PHOTO_DELETE,
    "TASK_REFERENCE_PHOTO_DELETE"
  )
})
