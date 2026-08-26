/**
 * OT 1.2 — vencidas release execution_order so Planning and Postgres agree.
 *
 * Strategy A: status → vencida clears execution_order (trigger + sync + backfill).
 * Unique index is unchanged. OT 1.1 occupancy (non-null execution_order) then
 * matches Planning.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  collectOccupiedOperationalOrderSlots,
  resolveNextPlanningQueuePosition,
} from "../lib/planificacion/planning-dynamic.ts"
import { occupiesExecutionOrderSlot } from "../lib/planificacion/planning-operational-order-core.ts"
import {
  applyVencidaExecutionOrderRelease,
  buildVencidaExecutionOrderReleasePatch,
  createAtomicExecutionOrderAllocator,
  resolveNextExecutionOrderFromOccupied,
  shouldAssignExecutionOrderOnCreate,
} from "../lib/tasks/execution-order-create.ts"
import { buildTaskVencidaAuditMetadata } from "../lib/audit/tasks-audit-shared.ts"
import { mergeVencidaStatusIntoTasks } from "../lib/tasks/vencida-sync.client.ts"
import { shouldApplyPlanningQueueSideEffectsForTask } from "../lib/projects/project-start-dispatch.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const sql12 = read(
  "supabase/migrations/20261143000100_ot_1_2_vencidas_execution_order.sql"
)
const sql11 = read(
  "supabase/migrations/20261142000100_ot_1_1_execution_order_atomic.sql"
)
const uniqueSql = read(
  "supabase/migrations/20260903000100_task_execution_order.sql"
)
const syncServer = read("lib/supabase/tasks-vencida-sync.server.ts")
const syncRoute = read("app/api/tasks/sync-vencida/route.ts")
const incidents = read(
  "components/tareas/tasks-provider/hooks/use-tasks-incidents.ts"
)
const planningHook = read(
  "components/tareas/tasks-provider/hooks/use-tasks-planning.ts"
)
const workflow = read("lib/tasks/task-status-workflow.ts")
const vencidaStatus = read("lib/tasks/vencida-status.ts")
const dynamic = read("lib/planificacion/planning-dynamic.ts")

const DATE = "2026-08-26"
const CREW = "crew-a"

function ot(overrides = {}) {
  return {
    id: "ot-a",
    projectCode: "OT",
    serviceType: "service-tecnico",
    status: "programada",
    crewId: CREW,
    dueDate: DATE,
    executionOrder: 1,
    dispatchOrder: null,
    projectId: undefined,
    ...overrides,
  }
}

function occupiedOrders(tasks, options) {
  const scope = tasks.filter(
    (task) => task.crewId === CREW && task.dueDate === DATE
  )
  return collectOccupiedOperationalOrderSlots(scope, options)
}

test("TEST 1: OT programada orden 1 ocupa slot", () => {
  const task = ot({ id: "ot-a", executionOrder: 1 })
  assert.equal(occupiesExecutionOrderSlot(task), true)
  assert.deepEqual([...occupiedOrders([task])].sort((a, b) => a - b), [1])
})

test("TEST 2: OT vencida no ocupa slot operativo tras la regla nueva", () => {
  const stale = ot({ id: "ot-b", executionOrder: 2, status: "vencida" })
  assert.equal(occupiesExecutionOrderSlot(stale), false)
  const released = applyVencidaExecutionOrderRelease(stale)
  assert.equal(released.executionOrder, null)
  assert.equal(occupiesExecutionOrderSlot(released), false)
  assert.equal(released.crewId, CREW)
  assert.equal(released.dueDate, DATE)
})

test("TEST 3 / escenario real: 1 programada, 2 vencida, 3 programada → nueva OT toma 2", () => {
  const a = ot({ id: "OT-A", executionOrder: 1, status: "programada" })
  const b = applyVencidaExecutionOrderRelease(
    ot({ id: "OT-B", executionOrder: 2, status: "vencida" })
  )
  const c = ot({ id: "OT-C", executionOrder: 3, status: "programada" })
  const tasks = [a, b, c]
  const next = resolveNextPlanningQueuePosition({
    tasks,
    dueDate: DATE,
    crewId: CREW,
  })
  assert.equal(next, 2)
  assert.equal(occupiesExecutionOrderSlot(b), false)
  assert.equal(a.executionOrder, 1)
  assert.equal(c.executionOrder, 3)
})

test("TEST 4: soft-deleted no ocupa slot", () => {
  assert.equal(
    occupiesExecutionOrderSlot(
      ot({ id: "gone", executionOrder: 1, deletedAt: "2026-08-26T12:00:00.000Z" })
    ),
    false
  )
  assert.match(uniqueSql, /deleted_at IS NULL/)
  assert.doesNotMatch(sql12, /deleted_at\s*=/)
})

test("TEST 5: otra cuadrilla no interfiere", () => {
  const a = ot({ id: "a", crewId: "crew-a", executionOrder: 1 })
  const other = ot({ id: "b", crewId: "crew-b", executionOrder: 1 })
  const next = resolveNextPlanningQueuePosition({
    tasks: [a, other],
    dueDate: DATE,
    crewId: "crew-a",
  })
  assert.equal(next, 2)
})

test("TEST 6: otra fecha no interfiere", () => {
  const a = ot({ id: "a", dueDate: DATE, executionOrder: 1 })
  const other = ot({ id: "b", dueDate: "2026-08-27", executionOrder: 1 })
  const next = resolveNextPlanningQueuePosition({
    tasks: [a, other],
    dueDate: DATE,
    crewId: CREW,
  })
  assert.equal(next, 2)
})

test("TEST 7: otra empresa no interfiere en el asignador OT 1.1", async () => {
  const allocator = createAtomicExecutionOrderAllocator()
  const orderA = await allocator.allocate({
    companyId: "company-a",
    crewId: CREW,
    dueDate: DATE,
  })
  const orderB = await allocator.allocate({
    companyId: "company-b",
    crewId: CREW,
    dueDate: DATE,
  })
  assert.equal(orderA, 1)
  assert.equal(orderB, 1)
})

test("TEST 8: OT de Obra no cambia su semántica", () => {
  const obra = ot({
    id: "obra-1",
    projectId: "project-1",
    projectCode: "OB-1",
    executionOrder: 1,
  })
  assert.equal(occupiesExecutionOrderSlot(obra), false)
  assert.equal(
    shouldAssignExecutionOrderOnCreate({
      projectId: "project-1",
      projectCode: "OB-1",
      crewId: CREW,
      dueDate: DATE,
      status: "programada",
    }),
    false
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: "project-1" }),
    false
  )
})

test("TEST 9: reprogramación de vencida obtiene posición válida en la nueva cola", () => {
  const overdue = applyVencidaExecutionOrderRelease(
    ot({ id: "ot-b", executionOrder: 2, status: "vencida" })
  )
  const peer = ot({
    id: "peer",
    dueDate: "2026-08-28",
    executionOrder: 1,
    status: "programada",
  })
  const next = resolveNextPlanningQueuePosition({
    tasks: [overdue, peer],
    dueDate: "2026-08-28",
    crewId: CREW,
    excludeTaskId: overdue.id,
  })
  assert.equal(next, 2)
  assert.match(incidents, /clearOperationalOrdersForOverdueReschedule/)
  assert.match(incidents, /resolveNextPlanningQueuePosition/)
  assert.doesNotMatch(
    incidents,
    /Do not keep or reallocate execution_order/
  )
})

test("TEST 10: Planning no cuenta vencida como posición activa", () => {
  const tasks = [
    ot({ id: "a", executionOrder: 1, status: "programada" }),
    applyVencidaExecutionOrderRelease(
      ot({ id: "b", executionOrder: 2, status: "vencida" })
    ),
    ot({ id: "c", executionOrder: 3, status: "programada" }),
  ]
  const occupied = occupiedOrders(tasks)
  assert.equal(occupied.has(2), false)
  assert.equal(occupied.has(1), true)
  assert.equal(occupied.has(3), true)
  assert.match(dynamic, /occupiesExecutionOrderSlot/)
})

test("TEST 11: vencer no borra identidad operativa", () => {
  const before = {
    id: "ot-b",
    code: "TSK-OT-101",
    status: "programada",
    dueDate: DATE,
    crewId: CREW,
    customerName: "Juan",
    serviceAddress: "Calle 1",
    executionOrder: 2,
  }
  const after = applyVencidaExecutionOrderRelease({
    ...before,
    status: "vencida",
  })
  assert.equal(after.id, before.id)
  assert.equal(after.code, before.code)
  assert.equal(after.dueDate, before.dueDate)
  assert.equal(after.crewId, before.crewId)
  assert.equal(after.customerName, before.customerName)
  assert.equal(after.serviceAddress, before.serviceAddress)
  assert.equal(after.executionOrder, null)
  assert.doesNotMatch(sql12, /SET crew_id/)
  assert.doesNotMatch(sql12, /SET due_date/)
  assert.doesNotMatch(sql12, /deleted_at =/)
})

test("TEST 12: unique de activas se mantiene", () => {
  assert.match(
    uniqueSql,
    /CREATE UNIQUE INDEX IF NOT EXISTS tasks_execution_order_crew_date_unique/
  )
  assert.doesNotMatch(sql12, /DROP INDEX/)
  assert.doesNotMatch(sql12, /CREATE UNIQUE INDEX/)
  const a = ot({ id: "a", executionOrder: 1 })
  const b = ot({ id: "b", executionOrder: 1 })
  assert.equal(occupiesExecutionOrderSlot(a), true)
  assert.equal(occupiesExecutionOrderSlot(b), true)
})

test("TEST 13: backfill solo toca vencidas con execution_order", () => {
  assert.match(
    sql12,
    /UPDATE public\.tasks\s+SET execution_order = NULL\s+WHERE status = 'vencida'\s+AND execution_order IS NOT NULL\s+AND deleted_at IS NULL/
  )
  const programada = applyVencidaExecutionOrderRelease(
    ot({ status: "programada", executionOrder: 4 })
  )
  assert.equal(programada.executionOrder, 4)
})

test("TEST 14: OT 1.1 sigue atómico y no se reescribe la migración histórica", () => {
  assert.match(sql11, /pg_advisory_xact_lock/)
  assert.match(sql11, /create_task_with_execution_order/)
  assert.doesNotMatch(sql12, /CREATE OR REPLACE FUNCTION public\.create_task_with_execution_order/)
  const queries = read("lib/supabase/tasks.queries.ts")
  assert.match(queries, /client\.rpc\("create_task_with_execution_order"/)
})

test("TEST 15: primer hueco disponible sigue funcionando", () => {
  assert.equal(resolveNextExecutionOrderFromOccupied([1, 3]), 2)
  assert.equal(resolveNextExecutionOrderFromOccupied([1, 2, 3]), 4)
})

test("escenario real luego del hueco: A=1 D=2 C=3 sin compactar al vencer", () => {
  const a = ot({ id: "OT-A", executionOrder: 1 })
  const b = applyVencidaExecutionOrderRelease(
    ot({ id: "OT-B", executionOrder: 2, status: "vencida" })
  )
  const c = ot({ id: "OT-C", executionOrder: 3 })
  const dOrder = resolveNextPlanningQueuePosition({
    tasks: [a, b, c],
    dueDate: DATE,
    crewId: CREW,
  })
  assert.equal(dOrder, 2)
  const afterCreate = [
    a,
    b,
    c,
    ot({ id: "OT-D", executionOrder: dOrder }),
  ]
  const occupied = occupiedOrders(afterCreate)
  assert.deepEqual([...occupied].sort((a, b) => a - b), [1, 2, 3])
  assert.doesNotMatch(sql12, /compactExecutionOrder/)
})

test("trigger libera execution_order en el mismo UPDATE a vencida", () => {
  assert.match(sql12, /release_task_execution_order_on_vencida/)
  assert.match(sql12, /BEFORE UPDATE OF status/)
  assert.match(sql12, /NEW\.execution_order := NULL/)
  assert.doesNotMatch(sql12, /NEW\.dispatch_order/)
})

test("sync automático es API lazy, no cron, y parchea execution_order NULL", () => {
  assert.match(syncRoute, /syncVencidaTasksWithAudit/)
  assert.match(vencidaStatus, /shouldAutoTransitionToVencida/)
  assert.doesNotMatch(syncRoute, /app\/api\/cron/)
  assert.match(syncServer, /buildVencidaExecutionOrderReleasePatch/)
  const patch = buildVencidaExecutionOrderReleasePatch()
  assert.equal(patch.status, "vencida")
  assert.equal(patch.executionOrder, null)
})

test("audit de vencida conserva orden anterior; merge de cliente lo libera", () => {
  const metadata = buildTaskVencidaAuditMetadata({
    status: "programada",
    dueDate: DATE,
    scheduledTime: "09:00",
    crewId: CREW,
    crew: "Cuadrilla A",
    executionOrder: 2,
  })
  assert.equal(metadata.orden_ejecucion_anterior, 2)
  assert.equal(metadata.estado_nuevo, "vencida")

  const merged = mergeVencidaStatusIntoTasks(
    [ot({ id: "x", status: "programada", executionOrder: 2 })],
    [{ id: "x", status: "vencida" }]
  )
  assert.equal(merged[0].status, "vencida")
  assert.equal(merged[0].executionOrder, null)
})

test("reactivación vencida → programada ya existe (reopen-planning), no se inventa", () => {
  assert.match(
    workflow,
    /"reopen-planning":\s*\{\s*from:\s*\["asignada", "vencida"\],\s*to:\s*"programada"\s*\}/
  )
  assert.match(planningHook, /resolveReopenExecutionOrder/)
  assert.match(
    workflow,
    /"reschedule-from-overdue":\s*\{\s*from:\s*\["vencida"\],\s*to:\s*"programada"\s*\}/
  )
})

test("migración 1.1 intacta; 1.2 no toca Obras dispatch", () => {
  assert.doesNotMatch(sql12, /start_project/)
  assert.doesNotMatch(sql12, /NEW\.dispatch_order/)
  assert.match(sql11, /Does not change vencida policy/)
})
