/**
 * BUG OT VENCIDAS 1.1 — overdue reschedule must clear execution/dispatch order.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("clearOperationalOrdersForOverdueReschedule nulls both order fields", () => {
  const source = read("lib/tasks/reschedule.ts")
  assert.match(source, /export function clearOperationalOrdersForOverdueReschedule/)
  assert.match(
    source,
    /executionOrder:\s*null[\s\S]*dispatchOrder:\s*null|dispatchOrder:\s*null[\s\S]*executionOrder:\s*null/
  )
})

test("vencida is not operational-order reorderable; OT 1.2 releases the slot", () => {
  const core = read("lib/planificacion/planning-operational-order-core.ts")
  assert.match(
    core,
    /OPERATIONAL_ORDER_REORDERABLE_STATUSES\s*=\s*\[[\s\S]*"programada"[\s\S]*\]/
  )
  assert.doesNotMatch(
    core,
    /OPERATIONAL_ORDER_REORDERABLE_STATUSES\s*=\s*\[[^\]]*"vencida"/
  )
  assert.match(core, /export function occupiesExecutionOrderSlot/)
})

test("overdue reschedule still clears orders before assigning a new slot", () => {
  const source = read(
    "components/tareas/tasks-provider/hooks/use-tasks-incidents.ts"
  )
  assert.match(source, /clearOperationalOrdersForOverdueReschedule/)
  assert.match(source, /reschedule-from-overdue/)
  assert.match(source, /resolveNextPlanningQueuePosition/)
})

test("unique constraint error maps to the observed user message", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  assert.match(queries, /tasks_execution_order_crew_date_unique/)
  assert.match(
    queries,
    /Ya existe otra OT con el mismo orden de ejecución para esa cuadrilla y fecha/
  )
})
