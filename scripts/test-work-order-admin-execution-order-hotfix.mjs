import assert from "node:assert/strict"
import test from "node:test"

import { mapUpdatePayloadToUpdate } from "../lib/supabase/tasks.mapper.ts"
import {
  buildAdminWorkOrderPatchPayload,
  computeNextExecutionOrderFromMax,
  resolveAdminWorkOrderExecutionOrderDestination,
  shouldRecalculateAdminWorkOrderExecutionOrder,
} from "../lib/tasks/work-order-admin-execution-order.ts"

function makeProgramadaOt(overrides = {}) {
  return {
    id: "task-1",
    status: "programada",
    crewId: "crew-a",
    dueDate: "2026-07-10",
    executionOrder: 1,
    ...overrides,
  }
}

test("cambio de cuadrilla requiere recálculo autoritativo server-side", () => {
  const existing = makeProgramadaOt({ crewId: "crew-a", executionOrder: 1 })
  const payload = { crewId: "crew-b", dueDate: "2026-07-10" }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), true)
  assert.deepEqual(
    resolveAdminWorkOrderExecutionOrderDestination(existing, payload),
    { crewId: "crew-b", dueDate: "2026-07-10" }
  )
  assert.equal(computeNextExecutionOrderFromMax(1), 2)
})

test("cambio de fecha requiere recálculo para cuadrilla + fecha destino", () => {
  const existing = makeProgramadaOt({
    crewId: "crew-a",
    dueDate: "2026-07-10",
    executionOrder: 1,
  })
  const payload = { dueDate: "2026-07-11" }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), true)
  assert.deepEqual(
    resolveAdminWorkOrderExecutionOrderDestination(existing, payload),
    { crewId: "crew-a", dueDate: "2026-07-11" }
  )
  assert.equal(computeNextExecutionOrderFromMax(2), 3)
})

test("cambio de cuadrilla y fecha usa ambos valores destino", () => {
  const existing = makeProgramadaOt({
    crewId: "crew-a",
    dueDate: "2026-07-10",
    executionOrder: 4,
  })
  const payload = { crewId: "crew-b", dueDate: "2026-07-11" }

  assert.equal(shouldRecalculateAdminWorkOrderExecutionOrder(existing, payload), true)
  assert.deepEqual(
    resolveAdminWorkOrderExecutionOrderDestination(existing, payload),
    { crewId: "crew-b", dueDate: "2026-07-11" }
  )
  assert.equal(computeNextExecutionOrderFromMax(1), 2)
})

test("excluye la propia OT al calcular MAX(execution_order)+1", () => {
  const maxFromPeersOnly = computeNextExecutionOrderFromMax(3)
  assert.equal(maxFromPeersOnly, 4)
})

test("OT asignada/vencida con execution_order residual cuenta como slot ocupado", () => {
  const residualMax = 1
  assert.equal(computeNextExecutionOrderFromMax(residualMax), 2)
})

test("sin cambio de cuadrilla ni fecha no recalcula y omite executionOrder del patch", () => {
  const existing = makeProgramadaOt({
    crewId: "crew-a",
    dueDate: "2026-07-10",
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
    dueDate: "2026-07-10",
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
