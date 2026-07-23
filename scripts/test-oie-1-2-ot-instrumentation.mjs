import assert from "node:assert/strict"
import test from "node:test"

import {
  mapWorkflowActionToActivityEmissions,
  planTaskActivityEmissions,
  planTaskCreateActivityEmissions,
} from "../lib/activity/adapters/tasks-activity.ts"
import { ACTIVITY_ACTIONS, ACTIVITY_RESULTS } from "../lib/activity/types.ts"

function baseTask(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    code: "OT-200",
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

test("OIE 1.2: crear OT → TASK_CREATE (+ TASK_SCHEDULE + TASK_ASSIGN_CREW)", () => {
  const task = /** @type {any} */ (baseTask())
  const planned = planTaskCreateActivityEmissions(task)
  const actions = planned.emissions.map((e) => e.action)

  assert.ok(actions.includes(ACTIVITY_ACTIONS.TASK_CREATE))
  assert.ok(actions.includes(ACTIVITY_ACTIONS.TASK_SCHEDULE))
  assert.ok(actions.includes(ACTIVITY_ACTIONS.TASK_ASSIGN_CREW))
  assert.equal(
    new Set(planned.emissions.map(() => planned.correlationId)).size,
    1
  )
})

test("OIE 1.2: crear OT sin cuadrilla → sin TASK_ASSIGN_CREW", () => {
  const task = /** @type {any} */ (baseTask({ crewId: null, crew: "" }))
  const actions = planTaskCreateActivityEmissions(task).emissions.map(
    (e) => e.action
  )
  assert.ok(actions.includes(ACTIVITY_ACTIONS.TASK_CREATE))
  assert.ok(actions.includes(ACTIVITY_ACTIONS.TASK_SCHEDULE))
  assert.equal(actions.includes(ACTIVITY_ACTIONS.TASK_ASSIGN_CREW), false)
})

test("OIE 1.2: asignar OT → TASK_ASSIGN_CREW", () => {
  const before = /** @type {any} */ (
    baseTask({ status: "programada", crewId: null, crew: "" })
  )
  const after = /** @type {any} */ (
    baseTask({
      status: "asignada",
      crewId: "33333333-3333-4333-8333-333333333333",
      crew: "Cuadrilla B",
    })
  )
  const emissions = mapWorkflowActionToActivityEmissions(
    "assign-crew",
    before,
    after
  )
  assert.equal(emissions[0].action, ACTIVITY_ACTIONS.TASK_ASSIGN_CREW)
  assert.equal(emissions[0].metadata.previousStatus, "programada")
  assert.equal(emissions[0].metadata.newStatus, "asignada")
})

test("OIE 1.2: iniciar OT → TASK_START + geo", () => {
  const before = /** @type {any} */ (baseTask({ status: "asignada" }))
  const after = /** @type {any} */ (baseTask({ status: "en-curso" }))
  const emissions = mapWorkflowActionToActivityEmissions("start", before, after)
  assert.equal(emissions[0].action, ACTIVITY_ACTIONS.TASK_START)
  assert.ok(emissions[0].geo)
  assert.equal(emissions[0].geo.latitude, -34.6)
})

test("OIE 1.2: finalizar OT → TASK_APPROVE (COMPLETED) + result SUCCESS", () => {
  const before = /** @type {any} */ (baseTask({ status: "pendiente-cierre" }))
  const after = /** @type {any} */ (baseTask({ status: "finalizada" }))
  const emissions = mapWorkflowActionToActivityEmissions(
    "approve",
    before,
    after
  )
  assert.equal(emissions[0].action, ACTIVITY_ACTIONS.TASK_APPROVE)
  assert.equal(emissions[0].result, ACTIVITY_RESULTS.SUCCESS)
})

test("OIE 1.2: reprogramar OT → TASK_RESCHEDULE", () => {
  const before = /** @type {any} */ (baseTask())
  const after = /** @type {any} */ (
    baseTask({ dueDate: "2026-07-25", scheduledTime: "15:00" })
  )
  const planned = planTaskActivityEmissions({
    before,
    after,
    payload: { dueDate: "2026-07-25", scheduledTime: "15:00" },
    workflowAction: "reschedule-from-overdue",
    rescheduleInput: { reason: "cliente_ausente", notes: "" },
  })
  assert.equal(planned.emissions[0].action, ACTIVITY_ACTIONS.TASK_RESCHEDULE)
  assert.equal(planned.emissions[0].metadata.reason, "cliente_ausente")
})

test("OIE 1.2: eliminar OT → TASK_DELETE (acción de catálogo)", () => {
  assert.equal(ACTIVITY_ACTIONS.TASK_DELETE, "TASK_DELETE")
})
