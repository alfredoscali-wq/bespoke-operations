import assert from "node:assert/strict"
import test from "node:test"

import { mapUpdatePayloadToUpdate } from "../lib/supabase/tasks.mapper.ts"
import {
  buildAdminWorkOrderPatchPayload,
  resolveAdminWorkOrderExecutionOrderDestination,
  resolveFirstAvailableExecutionOrderForScope,
  shouldRecalculateAdminWorkOrderExecutionOrder,
} from "../lib/tasks/work-order-admin-execution-order.ts"
import { buildCompactExecutionOrderUpdates } from "../lib/planificacion/planning-execution-order.ts"

const DATE = "2026-07-10"

function makeProgramadaOt(overrides = {}) {
  return {
    id: "task-1",
    status: "programada",
    crewId: "crew-a",
    dueDate: DATE,
    executionOrder: 1,
    dispatchOrder: null,
    ...overrides,
  }
}

test("cambio de cuadrilla requiere recálculo autoritativo server-side", () => {
  const existing = makeProgramadaOt({ crewId: "crew-a", executionOrder: 1 })
  const payload = { crewId: "crew-b", dueDate: DATE }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), true)
  assert.deepEqual(
    resolveAdminWorkOrderExecutionOrderDestination(existing, payload),
    { crewId: "crew-b", dueDate: DATE }
  )
})

test("destino usa primer slot libre en lugar de MAX+1", () => {
  const tasks = [
    makeProgramadaOt({ id: "task-1", executionOrder: 1 }),
    makeProgramadaOt({ id: "task-2", executionOrder: 2 }),
    makeProgramadaOt({ id: "task-3", executionOrder: 4 }),
  ]

  assert.equal(
    resolveFirstAvailableExecutionOrderForScope({
      tasks,
      dueDate: DATE,
      crewId: "crew-a",
    }),
    3
  )
})

test("origen admin compactable excluyendo OT movida", () => {
  const tasks = [
    makeProgramadaOt({ id: "moving", executionOrder: 2 }),
    makeProgramadaOt({ id: "peer-1", executionOrder: 1 }),
    makeProgramadaOt({ id: "peer-3", executionOrder: 3 }),
    makeProgramadaOt({ id: "peer-4", executionOrder: 4 }),
  ]

  const updates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: "crew-a",
    excludeTaskIds: ["moving"],
  })

  assert.deepEqual(
    updates
      .filter((update) => update.taskId !== "moving")
      .map((update) => [update.taskId, update.executionOrder]),
    [
      ["peer-3", 2],
      ["peer-4", 3],
    ]
  )
})

test("cambio de fecha requiere recálculo para cuadrilla + fecha destino", () => {
  const existing = makeProgramadaOt({
    crewId: "crew-a",
    dueDate: DATE,
    executionOrder: 1,
  })
  const payload = { dueDate: "2026-07-11" }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), true)
  assert.deepEqual(
    resolveAdminWorkOrderExecutionOrderDestination(existing, payload),
    { crewId: "crew-a", dueDate: "2026-07-11" }
  )
})

test("cambio de cuadrilla y fecha usa ambos valores destino", () => {
  const existing = makeProgramadaOt({
    crewId: "crew-a",
    dueDate: DATE,
    executionOrder: 4,
  })
  const payload = { crewId: "crew-b", dueDate: "2026-07-11" }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), true)
  assert.deepEqual(
    resolveAdminWorkOrderExecutionOrderDestination(existing, payload),
    { crewId: "crew-b", dueDate: "2026-07-11" }
  )
})

test("sin cambio de cuadrilla ni fecha no recalcula y omite executionOrder del patch", () => {
  const existing = makeProgramadaOt({
    crewId: "crew-a",
    dueDate: DATE,
    executionOrder: 3,
  })
  const payload = { title: "OT actualizada", executionOrder: 99 }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), false)

  const patchPayload = buildAdminWorkOrderPatchPayload(payload, undefined)
  assert.equal("executionOrder" in patchPayload, false)
})

test("executionOrder client-side stale se ignora cuando corresponde recalcular", () => {
  const existing = makeProgramadaOt({ crewId: "crew-a", executionOrder: 1 })
  const payload = {
    crewId: "crew-b",
    dueDate: DATE,
    executionOrder: 1,
  }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), true)

  const patchPayload = buildAdminWorkOrderPatchPayload(payload, 2)
  assert.equal(patchPayload.executionOrder, 2)
})

test("mapper persiste el executionOrder autoritativo como execution_order", () => {
  const update = mapUpdatePayloadToUpdate({ executionOrder: 4 })
  assert.equal(update.execution_order, 4)
})
