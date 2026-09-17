import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  filterActiveWorkOrders,
  matchesActiveWorkOrderListQuery,
  selectActiveWorkOrderListRows,
} from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

const SEP18_CODES = [
  "TSK-OT-981",
  "TSK-OT-982",
  "TSK-OT-983",
  "TSK-OT-984",
  "TSK-OT-985",
  "TSK-OT-986",
  "TSK-OT-987",
  "TSK-OT-988",
  "TSK-OT-989",
  "TSK-OT-990",
  "TSK-OT-991",
  "TSK-OT-992",
  "TSK-OT-993",
  "TSK-OT-995",
]

function row(overrides = {}) {
  return {
    id: overrides.id ?? overrides.code ?? "ot",
    code: overrides.code ?? "OT-1",
    status: overrides.status ?? "programada",
    projectId: overrides.projectId ?? null,
    deletedAt: overrides.deletedAt ?? null,
    dueDate: overrides.dueDate ?? "2026-09-18",
  }
}

test("1. OT programada aparece en Órdenes de Trabajo", () => {
  const tasks = [row({ status: "programada", code: "TSK-OT-981" })]
  assert.deepEqual(filterActiveWorkOrders(tasks).map((t) => t.code), [
    "TSK-OT-981",
  ])
  assert.equal(matchesActiveWorkOrderListQuery(tasks[0]), true)
})

test("2. OT asignada aparece", () => {
  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "asignada" })),
    true
  )
})

test("3. OT en-curso aparece", () => {
  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "en-curso" })),
    true
  )
})

test("4. OT pendiente-cierre aparece", () => {
  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "pendiente-cierre" })),
    true
  )
})

test("5. OT vencida aparece", () => {
  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "vencida" })),
    true
  )
})

test("6. OT finalizada NO aparece en el listado activo", () => {
  const tasks = [row({ status: "finalizada", code: "TSK-OT-OLD" })]
  assert.deepEqual(filterActiveWorkOrders(tasks), [])
  assert.equal(matchesActiveWorkOrderListQuery(tasks[0]), false)
})

test("7. OT cancelada NO aparece", () => {
  const tasks = [row({ status: "cancelada", code: "TSK-OT-CAN" })]
  assert.deepEqual(filterActiveWorkOrders(tasks), [])
  assert.equal(matchesActiveWorkOrderListQuery(tasks[0]), false)
})

test("8. OT recientes no quedan fuera por max_rows=1000 con >1000 históricas", () => {
  const historical = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `old-${index}`,
      code: `TSK-OLD-${String(index).padStart(4, "0")}`,
      status: "finalizada",
      dueDate: "2026-01-01",
    })
  )
  const recent = SEP18_CODES.map((code) =>
    row({ id: code, code, status: "programada", dueDate: "2026-09-18" })
  )
  const all = [...historical, ...recent]

  const unfilteredCap = [...all]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 1000)
  const unfilteredCodes = new Set(unfilteredCap.map((task) => task.code))
  for (const code of SEP18_CODES) {
    assert.equal(
      unfilteredCodes.has(code),
      false,
      `${code} would be dropped by unfiltered fetchTasks + max_rows=1000`
    )
  }

  const active = selectActiveWorkOrderListRows(all, 1000)
  const activeCodes = active.map((task) => task.code)
  for (const code of SEP18_CODES) {
    assert.ok(activeCodes.includes(code), `${code} must survive the active query`)
  }
  assert.equal(
    active.every((task) => task.status !== "finalizada"),
    true
  )
  assert.ok(active.length <= 1000)
})

test("9. OT-981 a OT-993 y OT-995 del 18/09 entran al listado activo", () => {
  const extras = [
    row({
      code: "TSK-OBRA-1",
      status: "programada",
      projectId: "project-1",
      dueDate: "2026-09-18",
    }),
    row({
      code: "TSK-OT-DELETED",
      status: "programada",
      deletedAt: "2026-09-16T20:00:00Z",
      dueDate: "2026-09-18",
    }),
  ]
  const recent = SEP18_CODES.map((code) =>
    row({ id: code, code, status: "programada", dueDate: "2026-09-18" })
  )
  const selected = selectActiveWorkOrderListRows([...extras, ...recent], 1000)
  assert.deepEqual(
    selected.map((task) => task.code).sort(),
    [...SEP18_CODES].sort()
  )
})

test("fetchTasks stays unscoped; active query is dedicated", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const fetchTasksBlock = queries.slice(
    queries.indexOf("export async function fetchTasks("),
    queries.indexOf("export async function fetchActiveWorkOrderListTasks(")
  )
  assert.equal(fetchTasksBlock.includes('.in("status"'), false)
  assert.equal(fetchTasksBlock.includes('.is("project_id", null)'), false)

  const activeBlock = queries.slice(
    queries.indexOf("export async function fetchActiveWorkOrderListTasks("),
    queries.indexOf("export async function fetchPlanningWorkOrderListTasks(")
  )
  assert.match(activeBlock, /\.in\("status", \[\.\.\.ACTIVE_WORK_ORDER_LIST_STATUSES\]\)/)
  assert.match(activeBlock, /\.is\("project_id", null\)/)
  assert.match(activeBlock, /\.is\("deleted_at", null\)/)
  assert.match(activeBlock, /\.eq\("company_id", companyId\)/)
})

test("only /tareas uses the active work-order list scope", () => {
  const tareasLayout = read("app/(dashboard)/tareas/layout.tsx")
  assert.match(tareasLayout, /listScope="activeWorkOrders"/)

  const archivoLayout = read("app/(dashboard)/operations/archivo-ot/layout.tsx")
  assert.equal(archivoLayout.includes("activeWorkOrders"), false)

  const operationalStacks = read(
    "components/providers/internal/operational-provider-stacks.tsx"
  )
  assert.equal(operationalStacks.includes("activeWorkOrders"), false)

  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")
  assert.match(load, /listActiveWorkOrderTasks/)
  assert.match(load, /listTasks\(/)
})
