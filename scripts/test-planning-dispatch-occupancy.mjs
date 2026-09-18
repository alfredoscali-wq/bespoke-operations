import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  collectPlanningConfirmOccupiedDispatchOrders,
  matchesPlanningConfirmDispatchOccupancyQuery,
  planningConfirmDispatchOccupancyKey,
} from "../lib/planificacion/planning-dispatch-occupancy.ts"
import { buildPlanningConfirmDispatchUpdates } from "../lib/planificacion/planning-incremental.ts"
import { PLANNING_WORK_ORDER_LIST_STATUSES } from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const DATE = "2026-09-18"
const CREW = "3c30f37c-ad0b-4418-8ac5-39f5d940f960"
const CREW_NAME = "Cuadrilla 2"

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function occupancyQuerySource() {
  const queries = read("lib/supabase/tasks.queries.ts")
  return queries.slice(
    queries.indexOf(
      "export async function fetchOccupiedDispatchOrdersForPlanningConfirm("
    ),
    queries.indexOf("export async function fetchCalendarWorkOrderListTasks(")
  )
}

function row(overrides = {}) {
  return {
    id: overrides.id ?? "ot",
    companyId: overrides.companyId ?? COMPANY,
    dueDate: overrides.dueDate ?? DATE,
    crewId: overrides.crewId ?? CREW,
    dispatchOrder:
      overrides.dispatchOrder === undefined ? 1 : overrides.dispatchOrder,
    deletedAt: overrides.deletedAt ?? null,
    status: overrides.status ?? "finalizada",
  }
}

function programada(id, code, executionOrder) {
  return {
    id,
    code,
    title: code,
    description: "",
    projectCode: "",
    projectName: "",
    type: "fiber",
    status: "programada",
    priority: "media",
    supervisor: "",
    crew: CREW_NAME,
    crewId: CREW,
    startDate: DATE,
    dueDate: DATE,
    estimatedDuration: "",
    checklist: [],
    progress: 0,
    executionOrder,
    dispatchOrder: null,
  }
}

test("finalizada con dispatch 1 ocupa slot 1", () => {
  assert.equal(
    matchesPlanningConfirmDispatchOccupancyQuery(
      row({ status: "finalizada", dispatchOrder: 1 }),
      COMPANY,
      DATE,
      CREW
    ),
    true
  )
  const occupied = collectPlanningConfirmOccupiedDispatchOrders(
    [row({ status: "finalizada", dispatchOrder: 1 })],
    COMPANY,
    DATE,
    CREW
  )
  assert.equal(occupied.has(1), true)
})

test("finalizada con dispatch 3 ocupa slot 3", () => {
  const occupied = collectPlanningConfirmOccupiedDispatchOrders(
    [row({ status: "finalizada", dispatchOrder: 3 })],
    COMPANY,
    DATE,
    CREW
  )
  assert.equal(occupied.has(3), true)
  assert.equal(occupied.has(1), false)
})

test("cancelada con dispatch 4 ocupa slot 4", () => {
  assert.equal(
    matchesPlanningConfirmDispatchOccupancyQuery(
      row({ status: "cancelada", dispatchOrder: 4 }),
      COMPANY,
      DATE,
      CREW
    ),
    true
  )
  const occupied = collectPlanningConfirmOccupiedDispatchOrders(
    [row({ status: "cancelada", dispatchOrder: 4 })],
    COMPANY,
    DATE,
    CREW
  )
  assert.equal(occupied.has(4), true)
})

test("soft-deleted con dispatch 5 NO ocupa slot 5", () => {
  assert.equal(
    matchesPlanningConfirmDispatchOccupancyQuery(
      row({
        status: "finalizada",
        dispatchOrder: 5,
        deletedAt: "2026-09-17T15:48:17.295+00:00",
      }),
      COMPANY,
      DATE,
      CREW
    ),
    false
  )
  const occupied = collectPlanningConfirmOccupiedDispatchOrders(
    [
      row({
        dispatchOrder: 5,
        deletedAt: "2026-09-17T15:48:17.295+00:00",
      }),
    ],
    COMPANY,
    DATE,
    CREW
  )
  assert.equal(occupied.has(5), false)
})

test("dispatch_order null NO ocupa slot", () => {
  assert.equal(
    matchesPlanningConfirmDispatchOccupancyQuery(
      row({ status: "cancelada", dispatchOrder: null }),
      COMPANY,
      DATE,
      CREW
    ),
    false
  )
})

test("caso real {1,3,4} genera 2,5,6,7", () => {
  const tasks = [
    programada("5edf5486-e1b4-4e23-b661-3031d5e2a75a", "TSK-OT-1001", 1),
    programada("20e676c0-078a-4173-9034-d61196893742", "TSK-OT-1002", 2),
    programada("4576f9c8-86a4-4ad2-9663-4a349d238606", "TSK-OT-984", 3),
    programada("8bcb07ab-e996-4632-968d-8f10e905476b", "TSK-OT-998", 4),
  ]
  const occupancyKey = planningConfirmDispatchOccupancyKey(DATE, CREW)
  const updates = buildPlanningConfirmDispatchUpdates({
    tasks,
    confirmingTaskIds: tasks.map((task) => task.id),
    occupiedDispatchOrdersByScope: {
      [occupancyKey]: [1, 3, 4],
    },
  })
  const byCode = Object.fromEntries(
    updates.map((update) => {
      const task = tasks.find((item) => item.id === update.taskId)
      return [task.code, update.dispatchOrder]
    })
  )

  assert.deepEqual(byCode, {
    "TSK-OT-1001": 2,
    "TSK-OT-1002": 5,
    "TSK-OT-984": 6,
    "TSK-OT-998": 7,
  })
})

test("si dispatch 2 está ocupado, salta al siguiente disponible", () => {
  const tasks = [
    programada("ot-a", "TSK-OT-A", 1),
    programada("ot-b", "TSK-OT-B", 2),
  ]
  const occupancyKey = planningConfirmDispatchOccupancyKey(DATE, CREW)
  const updates = buildPlanningConfirmDispatchUpdates({
    tasks,
    confirmingTaskIds: ["ot-a", "ot-b"],
    occupiedDispatchOrdersByScope: {
      [occupancyKey]: [1, 2],
    },
  })
  assert.deepEqual(
    updates.map((update) => update.dispatchOrder),
    [3, 4]
  )
})

test("si 1,2,3,4 están ocupados, la siguiente recibe 5", () => {
  const tasks = [programada("ot-a", "TSK-OT-A", 1)]
  const occupancyKey = planningConfirmDispatchOccupancyKey(DATE, CREW)
  const updates = buildPlanningConfirmDispatchUpdates({
    tasks,
    confirmingTaskIds: ["ot-a"],
    occupiedDispatchOrdersByScope: {
      [occupancyKey]: [1, 2, 3, 4],
    },
  })
  assert.equal(updates[0].dispatchOrder, 5)
})

test("ocupación de confirmación no usa fetchTasks() ni cambia el listado de Planificación", () => {
  const occupancyBlock = occupancyQuerySource()
  const hook = read("components/tareas/tasks-provider/hooks/use-tasks-planning.ts")
  const occupancyModule = read("lib/planificacion/planning-dispatch-occupancy.ts")

  assert.match(occupancyBlock, /\.eq\("company_id", companyId\)/)
  assert.match(occupancyBlock, /\.eq\("due_date", dueDate\)/)
  assert.match(occupancyBlock, /\.in\("crew_id", crewIds\)/)
  assert.match(occupancyBlock, /\.is\("deleted_at", null\)/)
  assert.match(occupancyBlock, /\.not\("dispatch_order", "is", null\)/)
  assert.equal(occupancyBlock.includes("fetchTasks("), false)
  assert.equal(occupancyBlock.includes('.in("status"'), false)
  assert.match(hook, /listOccupiedDispatchOrdersForPlanningConfirm/)
  assert.match(occupancyModule, /Status is intentionally ignored/)
  assert.equal(PLANNING_WORK_ORDER_LIST_STATUSES.includes("finalizada"), false)
  assert.equal(PLANNING_WORK_ORDER_LIST_STATUSES.includes("cancelada"), false)
  assert.equal(PLANNING_WORK_ORDER_LIST_STATUSES.includes("cerrada"), false)
})
