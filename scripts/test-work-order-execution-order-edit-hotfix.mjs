import assert from "node:assert/strict"
import test from "node:test"

import {
  buildWorkOrderFormFromTask,
  buildWorkOrderUpdatePayload,
} from "../lib/tasks/work-order.ts"

function makeProgramadaOt(overrides = {}) {
  return {
    id: "task-1",
    code: "TSK-OT-001",
    title: "OT prueba",
    description: "",
    projectCode: "OT",
    projectName: "Orden de trabajo",
    type: "maintenance",
    status: "programada",
    priority: "media",
    supervisor: "Supervisor A",
    crewId: "crew-a",
    crew: "Cuadrilla A",
    startDate: "2026-07-10",
    dueDate: "2026-07-10",
    estimatedDuration: "45 min",
    checklist: [],
    progress: 0,
    serviceType: "service-tecnico",
    serviceAddress: "Calle 123",
    locality: "Centro",
    executionOrder: 1,
    taskMetadata: {
      shift: "manana",
      reason: "sin-conexion",
      detail: "Sin servicio",
    },
    ...overrides,
  }
}

test("cambio de cuadrilla recalcula execution_order al siguiente libre", () => {
  const task = makeProgramadaOt({ id: "task-1", crewId: "crew-a", executionOrder: 1 })
  const peer = makeProgramadaOt({
    id: "task-2",
    code: "TSK-OT-002",
    crewId: "crew-b",
    crew: "Cuadrilla B",
    executionOrder: 1,
  })
  const form = {
    ...buildWorkOrderFormFromTask(task),
    crewId: "crew-b",
  }

  const payload = buildWorkOrderUpdatePayload({
    form,
    task,
    existingTasks: [task, peer],
    crew: { id: "crew-b", name: "Cuadrilla B", supervisor: "Supervisor B" },
  })

  assert.equal(payload.executionOrder, 2)
})

test("cambio de fecha recalcula execution_order al siguiente libre", () => {
  const task = makeProgramadaOt({
    id: "task-1",
    dueDate: "2026-07-10",
    startDate: "2026-07-10",
    executionOrder: 1,
  })
  const peer = makeProgramadaOt({
    id: "task-2",
    code: "TSK-OT-002",
    dueDate: "2026-07-11",
    startDate: "2026-07-11",
    executionOrder: 2,
  })
  const form = {
    ...buildWorkOrderFormFromTask(task),
    scheduledDate: "2026-07-11",
  }

  const payload = buildWorkOrderUpdatePayload({
    form,
    task,
    existingTasks: [task, peer],
    crew: { id: "crew-a", name: "Cuadrilla A", supervisor: "Supervisor A" },
  })

  assert.equal(payload.executionOrder, 3)
})

test("cambio de cuadrilla y fecha recalcula para la combinación destino", () => {
  const task = makeProgramadaOt({
    id: "task-1",
    crewId: "crew-a",
    dueDate: "2026-07-10",
    executionOrder: 4,
  })
  const peer = makeProgramadaOt({
    id: "task-2",
    code: "TSK-OT-002",
    crewId: "crew-b",
    crew: "Cuadrilla B",
    dueDate: "2026-07-11",
    startDate: "2026-07-11",
    executionOrder: 1,
  })
  const form = {
    ...buildWorkOrderFormFromTask(task),
    crewId: "crew-b",
    scheduledDate: "2026-07-11",
  }

  const payload = buildWorkOrderUpdatePayload({
    form,
    task,
    existingTasks: [task, peer],
    crew: { id: "crew-b", name: "Cuadrilla B", supervisor: "Supervisor B" },
  })

  assert.equal(payload.executionOrder, 2)
})

test("excluye la propia OT al calcular el siguiente execution_order", () => {
  const task = makeProgramadaOt({
    id: "task-1",
    crewId: "crew-a",
    dueDate: "2026-07-10",
    executionOrder: 1,
  })
  const staleDestinationRow = makeProgramadaOt({
    id: "task-1",
    crewId: "crew-b",
    crew: "Cuadrilla B",
    dueDate: "2026-07-11",
    startDate: "2026-07-11",
    executionOrder: 5,
  })
  const peer = makeProgramadaOt({
    id: "task-2",
    code: "TSK-OT-002",
    crewId: "crew-b",
    crew: "Cuadrilla B",
    dueDate: "2026-07-11",
    startDate: "2026-07-11",
    executionOrder: 3,
  })
  const form = {
    ...buildWorkOrderFormFromTask(task),
    crewId: "crew-b",
    scheduledDate: "2026-07-11",
  }

  const payload = buildWorkOrderUpdatePayload({
    form,
    task,
    existingTasks: [staleDestinationRow, peer],
    crew: { id: "crew-b", name: "Cuadrilla B", supervisor: "Supervisor B" },
  })

  assert.equal(payload.executionOrder, 4)
})

test("sin cambios de cuadrilla ni fecha mantiene execution_order actual", () => {
  const task = makeProgramadaOt({
    id: "task-1",
    crewId: "crew-a",
    dueDate: "2026-07-10",
    executionOrder: 3,
  })
  const peer = makeProgramadaOt({
    id: "task-2",
    code: "TSK-OT-002",
    crewId: "crew-a",
    executionOrder: 1,
  })
  const form = buildWorkOrderFormFromTask(task)

  const payload = buildWorkOrderUpdatePayload({
    form,
    task,
    existingTasks: [task, peer],
    crew: { id: "crew-a", name: "Cuadrilla A", supervisor: "Supervisor A" },
  })

  assert.equal("executionOrder" in payload, false)
})
