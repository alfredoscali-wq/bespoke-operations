import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanningConfirmDispatchUpdates } from "../lib/planificacion/planning-incremental.ts"
import {
  buildCompactExecutionOrderUpdates,
  buildCompactExecutionOrderUpdatesForScopes,
  buildExecutionOrderPersistPlan,
  buildExecutionOrderPositionUpdates,
  buildExecutionOrderSwapUpdates,
  collectExecutionOrderScopesFromTaskIds,
  mergeExecutionOrderUpdatesIntoTasks,
} from "../lib/planificacion/planning-execution-order.ts"
import {
  collectOccupiedOperationalOrderSlots,
  resolveFirstAvailableOperationalOrderSlot,
  resolveNextPlanningQueuePosition,
} from "../lib/planificacion/planning-dynamic.ts"
import { resolveTaskRouteOrder } from "../lib/tasks/dispatch-order.ts"
import {
  resolveFirstAvailableExecutionOrderForScope,
} from "../lib/tasks/work-order-admin-execution-order.ts"

const CREW = "crew-3"
const DATE = "2026-07-13"

function makeProgramada(id, executionOrder, overrides = {}) {
  return {
    id,
    code: `TSK-OT-${id}`,
    title: "OT",
    description: "",
    projectCode: "OT",
    projectName: "Orden de trabajo",
    type: "maintenance",
    status: "programada",
    priority: "media",
    crewId: CREW,
    crew: "Cuadrilla 3",
    dueDate: DATE,
    startDate: DATE,
    executionOrder,
    dispatchOrder: null,
    createdAt: `${id}-created`,
    ...overrides,
  }
}

function makeAsignada(id, dispatchOrder, overrides = {}) {
  return {
    ...makeProgramada(id, null, { status: "asignada", dispatchOrder }),
    executionOrder: null,
  }
}

function ordersForScope(tasks) {
  return tasks
    .filter((task) => task.status === "programada" && task.crewId === CREW)
    .sort((left, right) => left.executionOrder - right.executionOrder)
    .map((task) => task.executionOrder)
}

test("compactar 1..8,11,12,13 → 1..11 sin frozen slots", () => {
  const tasks = [
    ...Array.from({ length: 8 }, (_, index) =>
      makeProgramada(`p-${index + 1}`, index + 1)
    ),
    makeProgramada("p-11", 11),
    makeProgramada("p-12", 12),
    makeProgramada("p-13", 13),
  ]

  const updates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })

  assert.equal(updates.length, 3)
  assert.deepEqual(
    updates
      .slice()
      .sort((left, right) => (left.executionOrder ?? 0) - (right.executionOrder ?? 0)),
    [
      { taskId: "p-11", executionOrder: 9 },
      { taskId: "p-12", executionOrder: 10 },
      { taskId: "p-13", executionOrder: 11 },
    ]
  )
})

test("compactación no-op con secuencia ya normalizada", () => {
  const tasks = Array.from({ length: 5 }, (_, index) =>
    makeProgramada(`p-${index + 1}`, index + 1)
  )

  const updates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })

  assert.equal(updates.length, 0)
})

test("compactación respeta frozen slots de OT no reordenables", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-3", 3),
    makeProgramada("p-4", 4),
    makeAsignada("a-5", 5),
    makeProgramada("p-6", 6),
    makeProgramada("p-7", 7),
    makeProgramada("p-8", 8),
    makeAsignada("a-9", 9),
    makeProgramada("p-11", 11),
    makeProgramada("p-12", 12),
    makeProgramada("p-13", 13),
  ]

  const updates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })

  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)
  assert.deepEqual(ordersForScope(merged), [1, 2, 3, 4, 6, 7, 8, 10, 11, 12])
})

test("soft delete deja scope compactable excluyendo la OT eliminada", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-3", 3),
    makeProgramada("p-4", 4),
    makeProgramada("p-5", 5),
  ]

  const remaining = tasks.filter((task) => task.id !== "p-3")
  const updates = buildCompactExecutionOrderUpdates({
    tasks: remaining,
    dueDate: DATE,
    crewId: CREW,
  })

  assert.equal(updates.length, 2)
  assert.deepEqual(
    updates
      .slice()
      .sort((left, right) => (left.executionOrder ?? 0) - (right.executionOrder ?? 0)),
    [
      { taskId: "p-4", executionOrder: 3 },
      { taskId: "p-5", executionOrder: 4 },
    ]
  )
})

test("soft delete irrelevante no genera compactación", () => {
  const updates = buildCompactExecutionOrderUpdates({
    tasks: [makeProgramada("p-1", 1, { crewId: null, crew: "" })],
    dueDate: DATE,
    crewId: CREW,
  })

  assert.equal(updates.length, 0)
})

test("Planificar parcial compacta restantes tras confirmar huecos", () => {
  const tasks = [
    ...Array.from({ length: 8 }, (_, index) =>
      makeProgramada(`p-${index + 1}`, index + 1)
    ),
    makeProgramada("p-9", 9),
    makeProgramada("p-10", 10),
    makeProgramada("p-11", 11),
    makeProgramada("p-12", 12),
    makeProgramada("p-13", 13),
  ]

  const confirmingIds = ["p-9", "p-10"]
  const scopes = collectExecutionOrderScopesFromTaskIds(tasks, confirmingIds)
  assert.equal(scopes.length, 1)

  let workingTasks = tasks
  const dispatchUpdates = buildPlanningConfirmDispatchUpdates({
    tasks: workingTasks,
    confirmingTaskIds: confirmingIds,
  })

  assert.deepEqual(
    dispatchUpdates.map((update) => update.dispatchOrder).sort((a, b) => a - b),
    [9, 10]
  )

  workingTasks = workingTasks.map((task) => {
    const dispatchUpdate = dispatchUpdates.find((update) => update.taskId === task.id)
    if (!dispatchUpdate) {
      return task
    }

    return {
      ...task,
      status: "asignada",
      dispatchOrder: dispatchUpdate.dispatchOrder,
      executionOrder: null,
    }
  })

  assert.deepEqual(ordersForScope(workingTasks), [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13])

  const postUpdates = buildCompactExecutionOrderUpdates({
    tasks: workingTasks,
    dueDate: DATE,
    crewId: CREW,
  })

  assert.equal(postUpdates.length, 0)

  const merged = mergeExecutionOrderUpdatesIntoTasks(workingTasks, postUpdates)
  assert.deepEqual(ordersForScope(merged), [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13])
})

test("Planificar parcial con huecos muertos compacta restantes sin frozen", () => {
  const tasks = [
    ...Array.from({ length: 8 }, (_, index) =>
      makeProgramada(`p-${index + 1}`, index + 1)
    ),
    makeProgramada("p-11", 11),
    makeProgramada("p-12", 12),
    makeProgramada("p-13", 13),
  ]

  const postUpdates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, postUpdates)

  assert.deepEqual(ordersForScope(merged), Array.from({ length: 11 }, (_, index) => index + 1))
})

test("múltiples scopes deduplicados compactan una sola vez por scope", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-4", 4),
  ]

  const scopes = collectExecutionOrderScopesFromTaskIds(tasks, ["p-1", "p-2"])
  const updates = buildCompactExecutionOrderUpdatesForScopes({
    tasks,
    scopes,
  })

  assert.equal(scopes.length, 1)
  assert.deepEqual(updates, [{ taskId: "p-4", executionOrder: 3 }])
})

test("pre-Planificar con huecos normaliza antes del dispatch", () => {
  const tasks = [
    ...Array.from({ length: 8 }, (_, index) =>
      makeProgramada(`p-${index + 1}`, index + 1)
    ),
    makeProgramada("p-11", 11),
    makeProgramada("p-12", 12),
    makeProgramada("p-13", 13),
  ]

  const preUpdates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })
  const normalized = mergeExecutionOrderUpdatesIntoTasks(tasks, preUpdates)
  const dispatchUpdates = buildPlanningConfirmDispatchUpdates({
    tasks: normalized,
    confirmingTaskIds: tasks.map((task) => task.id),
  })

  assert.equal(dispatchUpdates.length, 11)
  assert.deepEqual(
    dispatchUpdates
      .map((update) => update.dispatchOrder)
      .sort((left, right) => left - right),
    Array.from({ length: 11 }, (_, index) => index + 1)
  )
})

test("creación usa primer slot libre sin frozen", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-3", 3),
    makeProgramada("p-4", 4),
    makeProgramada("p-7", 7),
    makeProgramada("p-8", 8),
  ]

  assert.equal(
    resolveNextPlanningQueuePosition({
      tasks,
      dueDate: DATE,
      crewId: CREW,
    }),
    5
  )
})

test("creación respeta frozen slots", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-3", 3),
    makeProgramada("p-4", 4),
    makeAsignada("a-5", 5),
    makeProgramada("p-7", 7),
    makeProgramada("p-8", 8),
  ]

  assert.equal(
    resolveNextPlanningQueuePosition({
      tasks,
      dueDate: DATE,
      crewId: CREW,
    }),
    6
  )
})

test("admin helper usa primer slot válido destino", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-4", 4, { crewId: "crew-b", crew: "Cuadrilla B" }),
  ]

  assert.equal(
    resolveFirstAvailableExecutionOrderForScope({
      tasks,
      dueDate: DATE,
      crewId: CREW,
      excludeTaskId: "moving-task",
    }),
    3
  )
})

test("admin crew change compacta origen excluyendo OT movida", () => {
  const tasks = [
    makeProgramada("moving-task", 2),
    makeProgramada("p-1", 1),
    makeProgramada("p-3", 3),
    makeProgramada("p-4", 4),
  ]

  const updates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
    excludeTaskIds: ["moving-task"],
  })

  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)
  assert.deepEqual(
    ordersForScope(merged.filter((task) => task.id !== "moving-task")),
    [1, 2, 3]
  )
})

test("reorder numérico normaliza secuencia con huecos", () => {
  const tasks = [
    ...Array.from({ length: 8 }, (_, index) =>
      makeProgramada(`p-${index + 1}`, index + 1)
    ),
    makeProgramada("p-11", 11),
    makeProgramada("p-12", 12),
    makeProgramada("p-13", 13),
  ]

  const updates = buildExecutionOrderPositionUpdates(tasks, "p-13", 2)
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)

  assert.deepEqual(ordersForScope(merged), Array.from({ length: 11 }, (_, i) => i + 1))
})

test("reorder numérico respeta frozen slots", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeAsignada("a-3", 3),
    makeProgramada("p-4", 4),
    makeProgramada("p-6", 6),
  ]

  const updates = buildExecutionOrderPositionUpdates(tasks, "p-6", 2)
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)

  assert.deepEqual(ordersForScope(merged), [1, 2, 4, 5])
})

test("▲/▼ compacta scope previamente desnormalizado", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-4", 4),
    makeProgramada("p-5", 5),
  ]

  const updates = buildExecutionOrderSwapUpdates(tasks, "p-5", "up")
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)

  assert.deepEqual(ordersForScope(merged), [1, 2, 3, 4])
})

test("persistencia en dos fases para compactación", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-4", 4),
  ]

  const updates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })
  const plan = buildExecutionOrderPersistPlan(updates, tasks)

  assert.equal(plan.phases.length, 2)
  assert.ok(plan.phases[0].every((update) => update.executionOrder === null))
  // Phase 2 must restore the full scope sequence after the unique-index clear,
  // not only the compacting diff (p-4 → 3).
  assert.deepEqual(
    plan.phases[1].map((update) => ({
      taskId: update.taskId,
      executionOrder: update.executionOrder,
    })),
    [
      { taskId: "p-1", executionOrder: 1 },
      { taskId: "p-2", executionOrder: 2 },
      { taskId: "p-4", executionOrder: 3 },
    ]
  )
})

test("asignar orden a OT B conserva posición 1 de OT A", () => {
  const tasks = [
    makeProgramada("ot-a", 1),
    makeProgramada("ot-b", null),
  ]

  const updates = buildExecutionOrderPositionUpdates(tasks, "ot-b", 2)
  const plan = buildExecutionOrderPersistPlan(updates, tasks)
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)

  assert.deepEqual(ordersForScope(merged), [1, 2])
  assert.equal(plan.phases.length, 2)
  assert.deepEqual(
    plan.phases[1].map((update) => ({
      taskId: update.taskId,
      executionOrder: update.executionOrder,
    })),
    [
      { taskId: "ot-a", executionOrder: 1 },
      { taskId: "ot-b", executionOrder: 2 },
    ]
  )
})

test("asignar OT C a orden 2 desplaza OT B y conserva OT A", () => {
  const tasks = [
    makeProgramada("ot-a", 1),
    makeProgramada("ot-b", 2),
    makeProgramada("ot-c", 3),
  ]

  const updates = buildExecutionOrderPositionUpdates(tasks, "ot-c", 2)
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)

  assert.equal(merged.find((task) => task.id === "ot-a")?.executionOrder, 1)
  assert.equal(merged.find((task) => task.id === "ot-c")?.executionOrder, 2)
  assert.equal(merged.find((task) => task.id === "ot-b")?.executionOrder, 3)

  const plan = buildExecutionOrderPersistPlan(updates, tasks)
  assert.deepEqual(
    plan.phases[1].map((update) => ({
      taskId: update.taskId,
      executionOrder: update.executionOrder,
    })),
    [
      { taskId: "ot-a", executionOrder: 1 },
      { taskId: "ot-c", executionOrder: 2 },
      { taskId: "ot-b", executionOrder: 3 },
    ]
  )
})

test("asignar OT D a orden libre 4 conserva 1-2-3", () => {
  const tasks = [
    makeProgramada("ot-a", 1),
    makeProgramada("ot-b", 2),
    makeProgramada("ot-c", 3),
    makeProgramada("ot-d", null),
  ]

  const updates = buildExecutionOrderPositionUpdates(tasks, "ot-d", 4)
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)
  const plan = buildExecutionOrderPersistPlan(updates, tasks)

  assert.deepEqual(ordersForScope(merged), [1, 2, 3, 4])
  assert.deepEqual(
    plan.phases[1].map((update) => ({
      taskId: update.taskId,
      executionOrder: update.executionOrder,
    })),
    [
      { taskId: "ot-a", executionOrder: 1 },
      { taskId: "ot-b", executionOrder: 2 },
      { taskId: "ot-c", executionOrder: 3 },
      { taskId: "ot-d", executionOrder: 4 },
    ]
  )
})

test("provider refleja números actualizados y conserva selección", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeProgramada("p-2", 2),
    makeProgramada("p-4", 4),
  ]
  const selectedTaskId = "p-4"

  const updates = buildCompactExecutionOrderUpdates({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })
  const merged = mergeExecutionOrderUpdatesIntoTasks(tasks, updates)
  const selected = merged.find((task) => task.id === selectedTaskId)

  assert.ok(selected)
  assert.equal(resolveTaskRouteOrder(selected), 3)
  assert.equal(merged.find((task) => task.id === selectedTaskId)?.id, selectedTaskId)
})

test("collectOccupiedOperationalOrderSlots evita duplicados", () => {
  const tasks = [
    makeProgramada("p-1", 1),
    makeAsignada("a-2", 2),
    makeProgramada("p-5", 5),
  ]

  const occupied = collectOccupiedOperationalOrderSlots(tasks)
  assert.deepEqual([...occupied].sort((a, b) => a - b), [1, 2, 5])
  assert.equal(resolveFirstAvailableOperationalOrderSlot(occupied), 3)
})

test("excludeTaskId libera slot al calcular append", () => {
  const tasks = [makeProgramada("p-1", 1), makeProgramada("moving", 2)]

  assert.equal(
    resolveNextPlanningQueuePosition({
      tasks,
      dueDate: DATE,
      crewId: CREW,
      excludeTaskId: "moving",
    }),
    2
  )
})
