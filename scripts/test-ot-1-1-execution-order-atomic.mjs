/**
 * OT 1.1 — atomic execution_order on create.
 *
 * Live concurrent RPC against Postgres is not executed here (would mutate
 * production/dev data). Concurrency is simulated with the same lock + first-gap
 * rule the migration implements. Apply
 * supabase/migrations/20261142000100_ot_1_1_execution_order_atomic.sql
 * before relying on the RPC in a live environment.
 *
 * Pending (not this sprint):
 * - OT vencidas occupancy policy → OT 1.2
 * - Persistent error log
 * - Create-endpoint idempotency keys (none exist today)
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  createAtomicExecutionOrderAllocator,
  resolveNextExecutionOrderFromOccupied,
  shouldAssignExecutionOrderOnCreate,
  stripClientExecutionOrder,
  TASK_EXECUTION_ORDER_CONFLICT_CODE,
  TASK_EXECUTION_ORDER_CONFLICT_MESSAGE,
} from "../lib/tasks/execution-order-create.ts"
import {
  mapInsertTaskError,
  mapSupabaseTaskError,
} from "../lib/supabase/tasks.queries.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const sql = read(
  "supabase/migrations/20261142000100_ot_1_1_execution_order_atomic.sql"
)
const originalUnique = read(
  "supabase/migrations/20260903000100_task_execution_order.sql"
)
const queries = read("lib/supabase/tasks.queries.ts")
const createHook = read(
  "components/tareas/tasks-provider/hooks/use-tasks-create.ts"
)
const importExecute = read("lib/tasks/work-order-import/execute.ts")
const adminMutation = read("lib/tasks/work-order-admin-mutation.server.ts")
const adminOrder = read("lib/tasks/work-order-admin-execution-order.ts")
const persistPlan = read("lib/planificacion/planning-execution-order.ts")
const reschedule = read("lib/tasks/reschedule.ts")
const vencidaSync = read("lib/supabase/tasks-vencida-sync.server.ts")

const plannedOt = {
  projectCode: "OT",
  serviceType: "service-tecnico",
  crewId: "crew-a",
  dueDate: "2026-08-25",
  status: "programada",
}

const companyA = "company-a"
const companyB = "company-b"
const crewA = "crew-a"
const crewB = "crew-b"
const dateA = "2026-08-25"
const dateB = "2026-08-26"

test("unique constraint remains the original partial index", () => {
  assert.match(
    originalUnique,
    /CREATE UNIQUE INDEX IF NOT EXISTS tasks_execution_order_crew_date_unique/
  )
  assert.match(
    originalUnique,
    /ON public\.tasks \(due_date, crew_id, execution_order\)/
  )
  assert.match(originalUnique, /WHERE execution_order IS NOT NULL/)
  assert.match(originalUnique, /crew_id IS NOT NULL/)
  assert.match(originalUnique, /deleted_at IS NULL/)
  assert.doesNotMatch(sql, /DROP INDEX[\s\S]*tasks_execution_order_crew_date_unique/)
  assert.doesNotMatch(sql, /tasks_execution_order_crew_date_unique[\s\S]*DROP/)
})

test("RPC locks company+crew+due_date then assigns first free slot in the same transaction", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_task_with_execution_order/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /hashtext\('ot-exec-order:' \|\| v_company_id::text\)/)
  assert.match(sql, /auth_user_company_id\(\)/)
  assert.match(sql, /INSERT INTO public\.tasks/)
  assert.match(sql, /v_execution_order/)
  assert.match(sql, /RETURNING \*/)
  const lockAt = sql.indexOf("pg_advisory_xact_lock")
  const nextAt = sql.indexOf("SELECT MAX(t.execution_order)")
  const insertAt = sql.indexOf("INSERT INTO public.tasks")
  assert.ok(lockAt > 0 && nextAt > lockAt && insertAt > nextAt)
})

test("client execution_order is ignored; assignment uses unique-index occupancy", () => {
  assert.match(sql, /execution_order,\s*\n\s*dispatch_order/)
  assert.match(sql, /v_execution_order,\s*\n\s*NULL/)
  assert.match(queries, /execution_order:\s*null/)
  assert.match(queries, /stripClientExecutionOrder/)
  assert.match(sql, /deleted_at IS NULL/)
  assert.match(sql, /t\.execution_order IS NOT NULL/)
})

test("crear OT con cuadrilla + fecha obtiene 1, luego 2, luego 3", () => {
  const occupied = []
  const first = resolveNextExecutionOrderFromOccupied(occupied)
  occupied.push(first)
  const second = resolveNextExecutionOrderFromOccupied(occupied)
  occupied.push(second)
  const third = resolveNextExecutionOrderFromOccupied(occupied)
  occupied.push(third)
  assert.deepEqual([first, second, third], [1, 2, 3])
  assert.equal(shouldAssignExecutionOrderOnCreate(plannedOt), true)
})

test("crear OT sin cuadrilla no asigna execution_order", () => {
  assert.equal(
    shouldAssignExecutionOrderOnCreate({ ...plannedOt, crewId: null }),
    false
  )
  assert.equal(
    shouldAssignExecutionOrderOnCreate({ ...plannedOt, crewId: "  " }),
    false
  )
})

test("crear OT sin fecha no asigna execution_order", () => {
  assert.equal(
    shouldAssignExecutionOrderOnCreate({ ...plannedOt, dueDate: null }),
    false
  )
  assert.equal(
    shouldAssignExecutionOrderOnCreate({ ...plannedOt, dueDate: "" }),
    false
  )
})

test("crear OT sin planificación no inventa orden ni cuadrilla/fecha", () => {
  assert.equal(
    shouldAssignExecutionOrderOnCreate({
      projectCode: "OT",
      serviceType: "service-tecnico",
      status: "programada",
    }),
    false
  )
  assert.doesNotMatch(sql, /v_due_date := CURRENT_DATE/)
  assert.doesNotMatch(sql, /v_crew_id := .*SELECT/)
})

test("OT de Obra no recibe execution_order en create", () => {
  assert.equal(
    shouldAssignExecutionOrderOnCreate({
      ...plannedOt,
      projectId: "project-1",
    }),
    false
  )
  assert.match(sql, /v_project_id IS NULL/)
})

test("deleted slot is reused (first gap), matching the unique predicate", () => {
  assert.equal(resolveNextExecutionOrderFromOccupied([1, 3]), 2)
})

test("company A does not affect company B", async () => {
  const allocator = createAtomicExecutionOrderAllocator()
  const orderA = await allocator.allocate({
    companyId: companyA,
    crewId: crewA,
    dueDate: dateA,
  })
  const orderB = await allocator.allocate({
    companyId: companyB,
    crewId: crewA,
    dueDate: dateA,
  })
  assert.equal(orderA, 1)
  assert.equal(orderB, 1)
})

test("cuadrilla A does not affect cuadrilla B", async () => {
  const allocator = createAtomicExecutionOrderAllocator()
  const orderA = await allocator.allocate({
    companyId: companyA,
    crewId: crewA,
    dueDate: dateA,
  })
  const orderB = await allocator.allocate({
    companyId: companyA,
    crewId: crewB,
    dueDate: dateA,
  })
  assert.equal(orderA, 1)
  assert.equal(orderB, 1)
})

test("fecha A does not affect fecha B", async () => {
  const allocator = createAtomicExecutionOrderAllocator()
  const orderA = await allocator.allocate({
    companyId: companyA,
    crewId: crewA,
    dueDate: dateA,
  })
  const orderB = await allocator.allocate({
    companyId: companyA,
    crewId: crewA,
    dueDate: dateB,
  })
  assert.equal(orderA, 1)
  assert.equal(orderB, 1)
})

test("three concurrent creates in the same scope get 1, 2, 3 without duplicates", async () => {
  const allocator = createAtomicExecutionOrderAllocator()
  const scope = { companyId: companyA, crewId: crewA, dueDate: dateA }
  const orders = await Promise.all([
    allocator.allocate(scope),
    allocator.allocate(scope),
    allocator.allocate(scope),
  ])
  assert.deepEqual([...orders].sort((a, b) => a - b), [1, 2, 3])
  assert.equal(new Set(orders).size, 3)
})

test("import loop of 10 OTs gets consecutive orders without a frontend array", async () => {
  const allocator = createAtomicExecutionOrderAllocator()
  const scope = { companyId: companyA, crewId: crewA, dueDate: dateA }
  const orders = []
  for (let index = 0; index < 10; index += 1) {
    orders.push(await allocator.allocate(scope))
  }
  assert.deepEqual(orders, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.doesNotMatch(importExecute, /resolveNextPlanningQueuePosition/)
  assert.match(importExecute, /await addTask\(payload\)/)
})

test("frontend no longer decides the definitive execution_order on create", () => {
  assert.doesNotMatch(createHook, /resolveNextPlanningQueuePosition/)
  assert.match(createHook, /stripClientExecutionOrder/)
  assert.match(createHook, /result\.data\.executionOrder/)
  const stripped = stripClientExecutionOrder({
    ...plannedOt,
    code: "TSK-OT-001",
    title: "OT",
    description: "",
    projectName: "Orden de trabajo",
    type: "fiber",
    priority: "media",
    supervisor: "A",
    crew: "Cuadrilla A",
    startDate: dateA,
    estimatedDuration: "45 min",
    checklist: [],
    executionOrder: 4,
  })
  assert.equal("executionOrder" in stripped, false)
})

test("insertTask goes through the atomic RPC, not a direct tasks insert", () => {
  assert.match(queries, /create_task_with_execution_order/)
  assert.match(queries, /client\.rpc\("create_task_with_execution_order"/)
  const insertStart = queries.indexOf("export async function insertTask")
  const insertEnd = queries.indexOf("export async function patchTask")
  const insertFn = queries.slice(insertStart, insertEnd)
  assert.doesNotMatch(insertFn, /\.from\("tasks"\)[\s\S]{0,80}\.insert/)
  assert.match(insertFn, /mapInsertTaskError/)
})

test("unexpected unique conflict returns TASK_EXECUTION_ORDER_CONFLICT, never SQL", () => {
  const fromHint = mapSupabaseTaskError({
    code: "P0001",
    message: TASK_EXECUTION_ORDER_CONFLICT_MESSAGE,
    hint: TASK_EXECUTION_ORDER_CONFLICT_CODE,
  })
  assert.equal(fromHint.code, TASK_EXECUTION_ORDER_CONFLICT_CODE)
  assert.equal(fromHint.message, TASK_EXECUTION_ORDER_CONFLICT_MESSAGE)

  const fromUnique = mapInsertTaskError({
    code: "23505",
    message: "duplicate key value violates unique constraint",
    details: "Key already exists.",
    hint: "tasks_execution_order_crew_date_unique",
  })
  assert.equal(fromUnique.code, TASK_EXECUTION_ORDER_CONFLICT_CODE)
  assert.equal(fromUnique.message, TASK_EXECUTION_ORDER_CONFLICT_MESSAGE)
  assert.doesNotMatch(fromUnique.message, /duplicate key/i)
  assert.doesNotMatch(fromUnique.message, /unique constraint/i)

  const patchPath = mapSupabaseTaskError({
    code: "23505",
    message: "duplicate key value violates unique constraint",
    details: "tasks_execution_order_crew_date_unique",
  })
  assert.equal(patchPath.code, "DUPLICATE_EXECUTION_ORDER")
})

test("create still logs conflict context without secrets", () => {
  assert.match(queries, /logOperationError\("TASK CREATE"/)
  assert.match(queries, /companyId:/)
  assert.match(queries, /crewId:/)
  assert.match(queries, /dueDate:/)
  assert.doesNotMatch(queries, /password|token|secret/i)
  assert.match(createHook, /logOperationError\("TASK CREATE"/)
})

test("regresión: creación de OT sigue en insertTask / addTask", () => {
  assert.match(createHook, /createTask\(payload, client\)/)
  assert.match(queries, /export async function insertTask/)
})

test("regresión: edición admin sigue usando fetchNextExecutionOrderForCrewDate", () => {
  assert.match(adminMutation, /fetchNextExecutionOrderForCrewDate/)
  assert.match(adminOrder, /shouldRecalculateAdminWorkOrderExecutionOrder/)
  assert.match(adminOrder, /buildAdminWorkOrderPatchPayload/)
})

test("regresión: reordenamiento persistido no fue rediseñado", () => {
  assert.match(persistPlan, /buildExecutionOrderPersistPlan/)
  assert.match(queries, /export async function persistExecutionOrderUpdates/)
})

test("regresión: reprogramación y vencidas no se modificaron en este sprint", () => {
  assert.match(reschedule, /clearOperationalOrdersForOverdueReschedule/)
  assert.doesNotMatch(sql, /status\s*=\s*'vencida'/)
  assert.doesNotMatch(sql, /WHERE[\s\S]{0,80}vencida/)
  assert.doesNotMatch(sql, /SET execution_order\s*=\s*NULL/)
  assert.match(vencidaSync, /status:\s*"vencida"/)
})

test("no create-time idempotency key exists yet (documented pending)", () => {
  assert.doesNotMatch(queries, /idempotency/i)
  assert.doesNotMatch(sql, /idempotency/i)
})
