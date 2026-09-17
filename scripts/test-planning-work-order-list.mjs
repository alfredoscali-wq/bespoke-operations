import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  matchesActiveWorkOrderListQuery,
  matchesArchivedWorkOrderListQuery,
  matchesPlanningWorkOrderListQuery,
  selectPlanningWorkOrderListRows,
} from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY = "00000000-0000-4000-8000-000000000001"

const SEP18_CODES = [
  "TSK-OT-827",
  "TSK-OT-911",
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

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function row(overrides = {}) {
  return {
    id: overrides.id ?? overrides.code ?? "ot",
    code: overrides.code ?? "OT-1",
    status: overrides.status ?? "programada",
    projectId: overrides.projectId ?? null,
    deletedAt: overrides.deletedAt ?? null,
    companyId: overrides.companyId ?? COMPANY,
    dueDate: overrides.dueDate ?? "2026-09-18",
  }
}

test("programada → incluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "programada" }), COMPANY),
    true
  )
})

test("asignada → incluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "asignada" }), COMPANY),
    true
  )
})

test("en-curso → incluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "en-curso" }), COMPANY),
    true
  )
})

test("vencida → incluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "vencida" }), COMPANY),
    true
  )
})

test("incidencia → incluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "incidencia" }), COMPANY),
    true
  )
})

test("pendiente-cierre → incluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(
      row({ status: "pendiente-cierre" }),
      COMPANY
    ),
    true
  )
})

test("en-aprobacion → incluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(
      row({ status: "en-aprobacion" }),
      COMPANY
    ),
    true
  )
})

test("finalizada → excluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "finalizada" }), COMPANY),
    false
  )
})

test("cancelada → excluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "cancelada" }), COMPANY),
    false
  )
})

test("borrador → excluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "borrador" }), COMPANY),
    false
  )
})

test("cerrada → excluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "cerrada" }), COMPANY),
    false
  )
})

test("deleted_at != null → excluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(
      row({ status: "programada", deletedAt: "2026-09-16T20:00:00Z" }),
      COMPANY
    ),
    false
  )
})

test("company_id de otro tenant → excluida", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(
      row({ status: "programada", companyId: OTHER_COMPANY }),
      COMPANY
    ),
    false
  )
})

test("OT de Obra con project_id sigue incluida (carril Obras / pendiente-cierre)", () => {
  assert.equal(
    matchesPlanningWorkOrderListQuery(
      row({
        status: "programada",
        projectId: "project-1",
        code: "TSK-OBRA-1",
      }),
      COMPANY
    ),
    true
  )
})

test("query de Planificación filtra company, deleted_at, status y due_date", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const planningBlock = queries.slice(
    queries.indexOf("export async function fetchPlanningWorkOrderListTasks("),
    queries.indexOf("export async function fetchArchivedWorkOrderListTasks(")
  )

  assert.match(planningBlock, /\.eq\("company_id", companyId\)/)
  assert.match(planningBlock, /\.is\("deleted_at", null\)/)
  assert.match(
    planningBlock,
    /\.in\("status", \[\.\.\.PLANNING_WORK_ORDER_LIST_STATUSES\]\)/
  )
  assert.match(planningBlock, /\.order\("due_date", \{ ascending: true \}\)/)
  assert.equal(planningBlock.includes('.is("project_id", null)'), false)
  assert.equal(planningBlock.includes("fetchTasks("), false)
})

test("OT del 18/09 no quedan fuera por max_rows=1000 con históricas", () => {
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
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code))
    .slice(0, 1000)
  const unfilteredCodes = new Set(unfilteredCap.map((task) => task.code))
  for (const code of ["TSK-OT-982", "TSK-OT-995"]) {
    assert.equal(
      unfilteredCodes.has(code),
      false,
      `${code} would be dropped by unfiltered fetchTasks + max_rows=1000`
    )
  }

  const selected = selectPlanningWorkOrderListRows(all, COMPANY, 1000)
  const selectedCodes = selected.map((task) => task.code)
  for (const code of SEP18_CODES) {
    assert.ok(selectedCodes.includes(code), `${code} must survive planning query`)
  }
  assert.equal(
    selected.every((task) => task.status !== "finalizada"),
    true
  )
  assert.ok(selected.length <= 1000)
})

test("fetchTasks global no fue modificado; active y archive siguen dedicados", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const fetchTasksBlock = queries.slice(
    queries.indexOf("export async function fetchTasks("),
    queries.indexOf("export async function fetchActiveWorkOrderListTasks(")
  )
  assert.equal(fetchTasksBlock.includes('.in("status"'), false)
  assert.equal(fetchTasksBlock.includes('.is("project_id", null)'), false)
  assert.equal(fetchTasksBlock.includes("PLANNING_WORK_ORDER_LIST"), false)

  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "programada" })),
    true
  )
  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "finalizada" })),
    false
  )
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "finalizada" })),
    true
  )
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "programada" })),
    false
  )

  const tareasLayout = read("app/(dashboard)/tareas/layout.tsx")
  assert.match(tareasLayout, /listScope="activeWorkOrders"/)
  assert.equal(tareasLayout.includes("planningWorkOrders"), false)

  const archivoLayout = read("app/(dashboard)/operations/archivo-ot/layout.tsx")
  assert.match(archivoLayout, /listScope="archiveWorkOrders"/)
  assert.equal(archivoLayout.includes("planningWorkOrders"), false)

  const planningLayout = read(
    "app/(dashboard)/operations/planificacion/layout.tsx"
  )
  assert.match(planningLayout, /PlanificacionModuleProviders/)

  const planningProviders = read(
    "components/providers/planificacion-module-providers.tsx"
  )
  assert.match(planningProviders, /listScope="planningWorkOrders"/)
  assert.equal(planningProviders.includes("activeWorkOrders"), false)
  assert.equal(planningProviders.includes("archiveWorkOrders"), false)

  const cuadrillasProviders = read(
    "components/providers/cuadrillas-module-providers.tsx"
  )
  assert.equal(cuadrillasProviders.includes("planningWorkOrders"), false)

  const operationalStacks = read(
    "components/providers/internal/operational-provider-stacks.tsx"
  )
  assert.equal(operationalStacks.includes("planningWorkOrders"), false)

  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")
  assert.match(load, /listPlanningWorkOrderTasks/)
  assert.match(load, /listActiveWorkOrderTasks/)
  assert.match(load, /listArchivedWorkOrderTasks/)
  assert.match(load, /listTasks\(/)
})
