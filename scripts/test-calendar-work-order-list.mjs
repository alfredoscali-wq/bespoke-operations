import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isDateWithinRange } from "../lib/availability/utils.ts"
import { getWeekStart } from "../lib/calendar/calendar-utils.ts"
import { getCalendarViewFilters } from "../lib/calendar/calendar-ui-utils.ts"
import { isCalendarOperationalTask } from "../lib/tasks/status-groups.ts"
import {
  matchesActiveWorkOrderListQuery,
  matchesArchivedWorkOrderListQuery,
  matchesCalendarWorkOrderListQuery,
  matchesPlanningWorkOrderListQuery,
  selectCalendarWorkOrderListRows,
} from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY = "00000000-0000-4000-8000-000000000001"
const DATE = "2026-09-18"

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
    dueDate: overrides.dueDate ?? DATE,
    startDate: overrides.startDate ?? DATE,
  }
}

function isEligibleForDefaultCalendarDay(task, date) {
  const weekStart = getWeekStart(date)
  const weekEnd = (() => {
    const next = new Date(`${weekStart}T12:00:00`)
    next.setDate(next.getDate() + 6)
    return next.toISOString().slice(0, 10)
  })()
  const view = getCalendarViewFilters("all")

  return (
    view.showTasks &&
    isCalendarOperationalTask(task.status) &&
    task.startDate <= weekEnd &&
    task.dueDate >= weekStart &&
    isDateWithinRange(date, task.startDate, task.dueDate)
  )
}

test("programada → incluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "programada" }), COMPANY),
    true
  )
})

test("asignada → incluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "asignada" }), COMPANY),
    true
  )
})

test("en-curso → incluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "en-curso" }), COMPANY),
    true
  )
})

test("vencida → incluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "vencida" }), COMPANY),
    true
  )
})

test("incidencia → incluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "incidencia" }), COMPANY),
    true
  )
})

test("pendiente-cierre → incluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(
      row({ status: "pendiente-cierre" }),
      COMPANY
    ),
    true
  )
})

test("en-aprobacion → incluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(
      row({ status: "en-aprobacion" }),
      COMPANY
    ),
    true
  )
})

test("finalizada → excluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "finalizada" }), COMPANY),
    false
  )
})

test("cancelada → excluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "cancelada" }), COMPANY),
    false
  )
})

test("borrador → excluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "borrador" }), COMPANY),
    false
  )
})

test("cerrada → excluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "cerrada" }), COMPANY),
    false
  )
})

test("deleted_at != null → excluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(
      row({ status: "programada", deletedAt: "2026-09-16T20:00:00Z" }),
      COMPANY
    ),
    false
  )
})

test("company_id de otro tenant → excluida", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(
      row({ status: "programada", companyId: OTHER_COMPANY }),
      COMPANY
    ),
    false
  )
})

test("project_id con valor → puede entrar", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(
      row({ status: "programada", projectId: "project-1" }),
      COMPANY
    ),
    true
  )
})

test("project_id null → puede entrar", () => {
  assert.equal(
    matchesCalendarWorkOrderListQuery(
      row({ status: "programada", projectId: null }),
      COMPANY
    ),
    true
  )
})

test("query de Calendario filtra company, deleted_at, status y due_date; no project_id", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const calendarBlock = queries.slice(
    queries.indexOf("export async function fetchCalendarWorkOrderListTasks("),
    queries.indexOf("export async function fetchArchivedWorkOrderListTasks(")
  )

  assert.match(calendarBlock, /\.eq\("company_id", companyId\)/)
  assert.match(calendarBlock, /\.is\("deleted_at", null\)/)
  assert.match(
    calendarBlock,
    /\.in\("status", \[\.\.\.CALENDAR_WORK_ORDER_LIST_STATUSES\]\)/
  )
  assert.match(calendarBlock, /\.order\("due_date", \{ ascending: true \}\)/)
  assert.equal(calendarBlock.includes('.is("project_id", null)'), false)
  assert.equal(calendarBlock.includes("fetchTasks("), false)
  assert.equal(calendarBlock.includes("PLANNING_WORK_ORDER_LIST"), false)
})

test("OT del 18/09 no quedan fuera por max_rows=1000 y son elegibles en filtros default", () => {
  const historical = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `old-${index}`,
      code: `TSK-OLD-${String(index).padStart(4, "0")}`,
      status: "finalizada",
      dueDate: "2026-01-01",
      startDate: "2026-01-01",
    })
  )
  const recent = SEP18_CODES.map((code) =>
    row({
      id: code,
      code,
      status: "programada",
      dueDate: DATE,
      startDate: DATE,
    })
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

  const selected = selectCalendarWorkOrderListRows(all, COMPANY, 1000)
  const selectedCodes = selected.map((task) => task.code)
  for (const code of SEP18_CODES) {
    assert.ok(selectedCodes.includes(code), `${code} must survive calendar query`)
  }
  assert.equal(
    selected.every((task) => task.status !== "finalizada"),
    true
  )
  assert.ok(selected.length <= 1000)

  const eligible = selected.filter((task) =>
    isEligibleForDefaultCalendarDay(task, DATE)
  )
  for (const code of SEP18_CODES) {
    assert.ok(
      eligible.some((task) => task.code === code),
      `${code} must be eligible on ${DATE} with default calendar filters`
    )
  }
})

test("fetchTasks global no fue modificado; active, archive y planning siguen dedicados", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const fetchTasksBlock = queries.slice(
    queries.indexOf("export async function fetchTasks("),
    queries.indexOf("export async function fetchActiveWorkOrderListTasks(")
  )
  assert.equal(fetchTasksBlock.includes('.in("status"'), false)
  assert.equal(fetchTasksBlock.includes('.is("project_id", null)'), false)
  assert.equal(fetchTasksBlock.includes("CALENDAR_WORK_ORDER_LIST"), false)
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
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "programada" }), COMPANY),
    true
  )
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "finalizada" }), COMPANY),
    false
  )

  const tareasLayout = read("app/(dashboard)/tareas/layout.tsx")
  assert.match(tareasLayout, /listScope="activeWorkOrders"/)
  assert.equal(tareasLayout.includes("calendarWorkOrders"), false)

  const archivoLayout = read("app/(dashboard)/operations/archivo-ot/layout.tsx")
  assert.match(archivoLayout, /listScope="archiveWorkOrders"/)
  assert.equal(archivoLayout.includes("calendarWorkOrders"), false)

  const planningProviders = read(
    "components/providers/planificacion-module-providers.tsx"
  )
  assert.match(planningProviders, /listScope="planningWorkOrders"/)
  assert.equal(planningProviders.includes("calendarWorkOrders"), false)

  const calendarLayout = read("app/(dashboard)/operations/calendar/layout.tsx")
  assert.match(calendarLayout, /CalendarModuleProviders/)

  const calendarProviders = read(
    "components/providers/calendar-module-providers.tsx"
  )
  assert.match(calendarProviders, /listScope="calendarWorkOrders"/)
  assert.equal(calendarProviders.includes("planningWorkOrders"), false)
  assert.equal(calendarProviders.includes("activeWorkOrders"), false)
  assert.equal(calendarProviders.includes("archiveWorkOrders"), false)

  const operationalStacks = read(
    "components/providers/internal/operational-provider-stacks.tsx"
  )
  assert.equal(operationalStacks.includes("calendarWorkOrders"), false)
  assert.equal(operationalStacks.includes("planningWorkOrders"), false)

  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")
  assert.match(load, /listCalendarWorkOrderTasks/)
  assert.match(load, /listPlanningWorkOrderTasks/)
  assert.match(load, /listActiveWorkOrderTasks/)
  assert.match(load, /listArchivedWorkOrderTasks/)
  assert.match(load, /listTasks\(/)
})
