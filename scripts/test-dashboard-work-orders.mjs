import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildDayOperations,
  buildExecutiveSummary,
  buildRecentOperationalActivity,
  buildTasksStatusKpis,
} from "../lib/data/dashboard.ts"
import { buildProjectOperationalMetricsMap } from "../lib/projects/project-operational-metrics.ts"
import {
  ACTIVE_TASK_STATUSES,
  FINAL_TASK_STATUSES,
} from "../lib/tasks/status-groups.ts"
import {
  countDashboardFinalizadaRows,
  DASHBOARD_FINALIZADA_COUNT_STATUS,
  DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES,
  DASHBOARD_RECENT_ACTIVITY_LIMIT,
  DASHBOARD_RECENT_ACTIVITY_WORK_ORDER_LIST_STATUSES,
  matchesActiveWorkOrderListQuery,
  matchesArchivedWorkOrderListQuery,
  matchesCalendarWorkOrderListQuery,
  matchesDashboardFinalizadaCountQuery,
  matchesDashboardProjectMetricCompletedQuery,
  matchesDashboardRecentActivityQuery,
  matchesDashboardWorkOrderListQuery,
  matchesPlanningWorkOrderListQuery,
  selectDashboardProjectMetricCompletedRows,
  selectDashboardRecentActivityRows,
  selectDashboardWorkOrderListRows,
} from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY = "00000000-0000-4000-8000-000000000001"
const TODAY = "2026-09-18"

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

function dashboardQuerySource() {
  const queries = read("lib/supabase/tasks.queries.ts")
  return queries.slice(
    queries.indexOf("export async function fetchDashboardWorkOrderListTasks("),
    queries.indexOf("export async function fetchArchivedWorkOrderListTasks(")
  )
}

function row(overrides = {}) {
  return {
    id: overrides.id ?? overrides.code ?? "ot",
    code: overrides.code ?? "OT-1",
    status: overrides.status ?? "programada",
    projectId: overrides.projectId ?? null,
    deletedAt: overrides.deletedAt ?? null,
    companyId: overrides.companyId ?? COMPANY,
    dueDate: overrides.dueDate ?? TODAY,
    startDate: overrides.startDate ?? TODAY,
    createdAt: overrides.createdAt ?? null,
    title: overrides.title ?? overrides.code ?? "OT-1",
  }
}

test("Dashboard query has company_id, deleted_at IS NULL, operational statuses and today bounds", () => {
  const dashboardBlock = dashboardQuerySource()

  assert.match(dashboardBlock, /\.eq\("company_id", companyId\)/)
  assert.match(dashboardBlock, /\.is\("deleted_at", null\)/)
  assert.match(
    dashboardBlock,
    /\.in\("status", \[\.\.\.DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES\]\)/
  )
  assert.match(
    dashboardBlock,
    /\.in\("status", \[\.\.\.DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES\]\)/
  )
  assert.match(dashboardBlock, /\.eq\("due_date", today\)/)
  assert.equal(dashboardBlock.includes("fetchTasks("), false)
  assert.equal(dashboardBlock.includes('.is("project_id", null)'), false)
  assert.equal(dashboardBlock.includes("PLANNING_WORK_ORDER_LIST"), false)
  assert.equal(dashboardBlock.includes("CALENDAR_WORK_ORDER_LIST_STATUSES"), false)
})

test("tenant isolation and deleted_at IS NULL on every dashboard query", () => {
  const dashboardBlock = dashboardQuerySource()
  const companyFilters = dashboardBlock.match(/\.eq\("company_id", companyId\)/g) ?? []
  const deletedFilters = dashboardBlock.match(/\.is\("deleted_at", null\)/g) ?? []

  assert.equal(companyFilters.length, 5)
  assert.equal(deletedFilters.length, 5)
})

test("programada operativa se incluye sin filtro de fecha", () => {
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ status: "programada", dueDate: "2026-10-01" }),
      COMPANY,
      TODAY
    ),
    true
  )
})

test("asignada / en-curso / vencida / incidencia / pendiente-cierre / en-aprobacion se incluyen", () => {
  for (const status of [
    "asignada",
    "en-curso",
    "vencida",
    "incidencia",
    "pendiente-cierre",
    "en-aprobacion",
  ]) {
    assert.equal(
      matchesDashboardWorkOrderListQuery(row({ status }), COMPANY, TODAY),
      true,
      status
    )
  }
})

test("borrador forma parte de Pendientes y entra al universo operativo", () => {
  assert.equal(ACTIVE_TASK_STATUSES.includes("borrador"), true)
  assert.equal(
    DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES.includes("borrador"),
    true
  )
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ status: "borrador", dueDate: TODAY }),
      COMPANY,
      TODAY
    ),
    true
  )

  const summary = buildExecutiveSummary({
    projects: [],
    tasks: [
      row({ id: "draft", status: "borrador" }),
      row({ id: "sched", status: "programada" }),
      row({ id: "done", status: "finalizada" }),
    ],
    crews: [],
    alertsCount: 0,
    crewAvailabilityContext: { availabilityRecords: [] },
  })
  const pending = summary.find((item) => item.id === "pending-tasks")
  assert.equal(pending?.value, "2")
})

test("finalizada de hoy aparece en el payload; finalizada histórica no se carga como row", () => {
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ status: "finalizada", dueDate: TODAY, code: "TSK-FIN-TODAY" }),
      COMPANY,
      TODAY
    ),
    true
  )
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({
        status: "finalizada",
        dueDate: "2026-01-01",
        code: "TSK-FIN-OLD",
      }),
      COMPANY,
      TODAY
    ),
    false
  )
})

test("cerrada de hoy aparece (KPI finalizadas hoy); cancelada no entra al payload operativo", () => {
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ status: "cerrada", dueDate: TODAY }),
      COMPANY,
      TODAY
    ),
    true
  )
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ status: "cancelada", dueDate: TODAY }),
      COMPANY,
      TODAY
    ),
    false
  )
})

test("deleted_at y otro tenant quedan fuera; project_id puede entrar", () => {
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ deletedAt: "2026-09-16T20:00:00Z" }),
      COMPANY,
      TODAY
    ),
    false
  )
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ companyId: OTHER_COMPANY }),
      COMPANY,
      TODAY
    ),
    false
  )
  assert.equal(
    matchesDashboardWorkOrderListQuery(
      row({ projectId: "project-1", status: "programada" }),
      COMPANY,
      TODAY
    ),
    true
  )
})

test("OT posterior a la fila 1000 entra; históricas finalizadas no se cargan en el payload", () => {
  const historical = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `old-${index}`,
      code: `TSK-OLD-${String(index).padStart(4, "0")}`,
      status: "finalizada",
      dueDate: "2026-01-01",
    })
  )
  const recent = SEP18_CODES.map((code) =>
    row({ id: code, code, status: "programada", dueDate: TODAY })
  )
  const finishedToday = row({
    id: "fin-today",
    code: "TSK-FIN-TODAY",
    status: "finalizada",
    dueDate: TODAY,
  })
  const all = [...historical, ...recent, finishedToday]

  const unfilteredCap = [...all]
    .sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code)
    )
    .slice(0, 1000)
  const unfilteredCodes = new Set(unfilteredCap.map((task) => task.code))
  assert.equal(unfilteredCodes.has("TSK-OT-995"), false)
  assert.equal(unfilteredCodes.has("TSK-FIN-TODAY"), false)

  const selected = selectDashboardWorkOrderListRows(all, COMPANY, TODAY, 1000)
  const selectedCodes = selected.map((task) => task.code)
  for (const code of SEP18_CODES) {
    assert.ok(selectedCodes.includes(code), `${code} must reach Dashboard`)
  }
  assert.ok(selectedCodes.includes("TSK-FIN-TODAY"))
  assert.equal(
    selected.some((task) => task.code.startsWith("TSK-OLD-")),
    false
  )
  assert.ok(selected.length <= 1000)

  const day = buildDayOperations({
    tasks: selected,
    evidence: [],
    referenceDate: TODAY,
  })
  const completedToday = day.find((item) => item.id === "completed-today")
  assert.equal(completedToday?.value, 1)

  const scheduledToday = day.find((item) => item.id === "scheduled-today")
  assert.equal(scheduledToday?.value, SEP18_CODES.length)

  const statusKpis = buildTasksStatusKpis(selected)
  const finalizadaKpi = statusKpis.find((item) => item.id === "finalizada")
  assert.equal(finalizadaKpi?.value, 1)
})

test("Finalizadas usa COUNT histórico y no depende del límite 1000", () => {
  const dashboardBlock = dashboardQuerySource()
  assert.match(
    dashboardBlock,
    /\.select\("id", \{ count: "exact", head: true \}\)/
  )
  assert.match(
    dashboardBlock,
    /\.eq\("status", DASHBOARD_FINALIZADA_COUNT_STATUS\)/
  )

  const countQuery = dashboardBlock.match(
    /\.select\("id", \{ count: "exact", head: true \}\)[\s\S]*?DASHBOARD_FINALIZADA_COUNT_STATUS/
  )
  assert.ok(countQuery, "COUNT query must be present")
  assert.equal(countQuery[0].includes("due_date"), false)
  assert.equal(countQuery[0].includes('select("*")'), false)
  assert.equal(DASHBOARD_FINALIZADA_COUNT_STATUS, "finalizada")

  const historical = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `old-${index}`,
      code: `TSK-OLD-${String(index).padStart(4, "0")}`,
      status: "finalizada",
      dueDate: "2026-01-01",
    })
  )
  const finishedToday = row({
    id: "fin-today",
    status: "finalizada",
    dueDate: TODAY,
  })
  const cerrada = row({
    id: "closed-old",
    status: "cerrada",
    dueDate: "2026-01-01",
  })
  const otherTenant = row({
    id: "other",
    status: "finalizada",
    companyId: OTHER_COMPANY,
    dueDate: "2026-01-01",
  })
  const deleted = row({
    id: "deleted",
    status: "finalizada",
    deletedAt: "2026-01-02T00:00:00Z",
    dueDate: "2026-01-01",
  })
  const all = [...historical, finishedToday, cerrada, otherTenant, deleted]

  assert.equal(countDashboardFinalizadaRows(all, COMPANY), 1101)
  assert.equal(
    matchesDashboardFinalizadaCountQuery(
      row({ status: "finalizada", dueDate: "2020-01-01" }),
      COMPANY
    ),
    true
  )
  assert.equal(
    matchesDashboardFinalizadaCountQuery(cerrada, COMPANY),
    false
  )

  const payloadFinalizadas = selectDashboardWorkOrderListRows(
    all,
    COMPANY,
    TODAY,
    1000
  ).filter((task) => task.status === "finalizada")
  assert.equal(payloadFinalizadas.length, 1)
})

test("Finalizadas hoy sigue usando due_date = today, independiente del COUNT", () => {
  const dashboardBlock = dashboardQuerySource()
  assert.match(
    dashboardBlock,
    /\.in\("status", \[\.\.\.DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES\]\)/
  )
  assert.match(dashboardBlock, /\.eq\("due_date", today\)/)

  const day = buildDayOperations({
    tasks: [
      row({ id: "today-fin", status: "finalizada", dueDate: TODAY }),
      row({ id: "today-closed", status: "cerrada", dueDate: TODAY }),
      row({ id: "old-fin", status: "finalizada", dueDate: "2026-01-01" }),
    ],
    evidence: [],
    referenceDate: TODAY,
  })
  const completedToday = day.find((item) => item.id === "completed-today")
  assert.equal(completedToday?.value, 2)
})

test("una OT cancelada recientemente puede aparecer en actividad reciente", () => {
  assert.deepEqual(
    DASHBOARD_RECENT_ACTIVITY_WORK_ORDER_LIST_STATUSES,
    FINAL_TASK_STATUSES
  )
  assert.equal(DASHBOARD_RECENT_ACTIVITY_LIMIT, 10)

  const dashboardBlock = dashboardQuerySource()
  assert.match(
    dashboardBlock,
    /\.in\("status", \[\.\.\.DASHBOARD_RECENT_ACTIVITY_WORK_ORDER_LIST_STATUSES\]\)/
  )
  assert.match(
    dashboardBlock,
    /\.order\("created_at", \{ ascending: false \}\)/
  )
  assert.match(dashboardBlock, /\.limit\(DASHBOARD_RECENT_ACTIVITY_LIMIT\)/)

  const cancelled = row({
    id: "cancel-recent",
    code: "TSK-CANCEL-1",
    status: "cancelada",
    dueDate: "2026-01-01",
    createdAt: "2026-09-18T15:00:00.000Z",
  })
  const oldFinal = row({
    id: "fin-old",
    code: "TSK-FIN-OLD",
    status: "finalizada",
    dueDate: "2025-01-01",
    createdAt: "2025-01-01T10:00:00.000Z",
  })

  assert.equal(
    matchesDashboardWorkOrderListQuery(cancelled, COMPANY, TODAY),
    false
  )
  assert.equal(matchesDashboardRecentActivityQuery(cancelled, COMPANY), true)
  assert.equal(
    matchesDashboardRecentActivityQuery(
      row({ ...cancelled, companyId: OTHER_COMPANY }),
      COMPANY
    ),
    false
  )

  const selected = selectDashboardRecentActivityRows(
    [cancelled, oldFinal],
    COMPANY
  )
  assert.equal(selected[0]?.id, "cancel-recent")
  assert.ok(selected.length <= DASHBOARD_RECENT_ACTIVITY_LIMIT)

  const feed = buildRecentOperationalActivity({
    projects: [],
    tasks: selected,
    evidence: [],
    crews: [],
    crewAvailabilityContext: { availabilityRecords: [] },
  })
  assert.ok(feed.some((item) => item.message.includes("TSK-CANCEL-1")))
})

test("una OT finalizada histórica de una Obra contribuye al progreso", () => {
  const dashboardBlock = dashboardQuerySource()
  assert.match(dashboardBlock, /\.not\("project_id", "is", null\)/)
  assert.match(
    dashboardBlock,
    /\.in\("status", \[\.\.\.DASHBOARD_PROJECT_METRIC_COMPLETED_STATUSES\]\)/
  )
  assert.match(dashboardBlock, /DASHBOARD_PROJECT_METRIC_PAGE_SIZE/)

  const historicalObra = row({
    id: "obra-fin-old",
    status: "finalizada",
    projectId: "obra-1",
    dueDate: "2026-01-01",
  })
  assert.equal(
    matchesDashboardProjectMetricCompletedQuery(historicalObra, COMPANY),
    true
  )
  assert.equal(
    matchesDashboardProjectMetricCompletedQuery(
      row({ status: "finalizada", projectId: null, dueDate: "2026-01-01" }),
      COMPANY
    ),
    false
  )
  assert.equal(
    matchesDashboardProjectMetricCompletedQuery(
      row({
        ...historicalObra,
        companyId: OTHER_COMPANY,
      }),
      COMPANY
    ),
    false
  )

  const manyHistorical = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `obra-old-${index}`,
      code: `OB-OLD-${index}`,
      status: "finalizada",
      projectId: "obra-1",
      dueDate: "2026-01-01",
    })
  )
  const paged = selectDashboardProjectMetricCompletedRows(
    manyHistorical,
    COMPANY,
    1000
  )
  assert.equal(paged.length, 1100)

  const project = {
    id: "obra-1",
    code: "OB-1",
    name: "Obra",
    client: "Cliente",
    type: "fiber",
    status: "active",
    progress: 0,
    supervisor: "Supervisor",
    location: "CABA",
    description: "",
    endDate: "2026-09-23",
  }
  const pending = row({
    id: "obra-pending",
    status: "programada",
    projectId: "obra-1",
    dueDate: TODAY,
  })
  const completed = Array.from({ length: 4 }, (_, index) =>
    row({
      id: `obra-done-${index}`,
      status: "finalizada",
      projectId: "obra-1",
      dueDate: "2026-01-01",
    })
  )
  const referenceDate = new Date(`${TODAY}T12:00:00`)

  const withoutHistory = buildProjectOperationalMetricsMap(
    [project],
    [pending],
    referenceDate
  )
  assert.equal(withoutHistory.get("obra-1")?.progress, 0)
  assert.equal(withoutHistory.get("obra-1")?.health, "risk")

  const withHistory = buildProjectOperationalMetricsMap(
    [project],
    [pending, ...completed],
    referenceDate
  )
  assert.equal(withHistory.get("obra-1")?.completedTasks, 4)
  assert.equal(withHistory.get("obra-1")?.progress, 80)
  assert.equal(withHistory.get("obra-1")?.health, "healthy")
})

test("builders y fórmulas de KPI existentes no se modificaron", () => {
  const dashboard = read("lib/data/dashboard.ts")
  assert.match(dashboard, /value: summary.finalizada/)
  assert.match(dashboard, /href: "\/tareas\?status=finalizada"/)
  assert.match(dashboard, /label: "Finalizadas"/)
  assert.match(dashboard, /FINAL_TASK_STATUSES.includes\(task.status\)/)
  assert.match(dashboard, /input.limit \?\? 10/)
  assert.match(
    dashboard,
    /const pendingAttention = tasks.filter\(\(task\) =>\s+ACTIVE_TASK_STATUSES.includes\(task.status\)/s
  )
  assert.match(
    dashboard,
    /\(task.status === "finalizada" \|\| task.status === "cerrada"\) &&\s+task.dueDate === today/s
  )
  assert.match(dashboard, /buildProjectOperationalMetricsMap/)
  assert.equal(dashboard.includes("toLocalDateOnly"), false)
  assert.match(dashboard, /toDateOnly\(\)/)

  const page = read("components/dashboard/dashboard-page-client.tsx")
  assert.match(page, /dashboardFinalizadaCount/)
  assert.match(page, /kpi.id === "finalizada"/)
  assert.match(page, /dashboardProjectMetricTasks/)
  assert.match(page, /tasksForProjectHealth/)
  assert.match(page, /buildTasksStatusKpis\(tasks\)/)
  assert.match(page, /buildRecentOperationalActivity/)
})

test("Dashboard no usa fetchTasks(); active/archive/planning/calendar siguen dedicados", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const fetchTasksBlock = queries.slice(
    queries.indexOf("export async function fetchTasks("),
    queries.indexOf("export async function fetchActiveWorkOrderListTasks(")
  )
  assert.equal(fetchTasksBlock.includes('.in("status"'), false)
  assert.equal(fetchTasksBlock.includes("DASHBOARD_"), false)

  const dashboardProviders = read(
    "components/providers/dashboard-home-providers.tsx"
  )
  assert.match(dashboardProviders, /listScope="dashboardWorkOrders"/)
  assert.equal(dashboardProviders.includes("fetchTasks"), false)

  const homePage = read("app/(dashboard)/page.tsx")
  assert.match(homePage, /DashboardHomeProviders/)

  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "programada" })),
    true
  )
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "finalizada" })),
    true
  )
  assert.equal(
    matchesPlanningWorkOrderListQuery(row({ status: "programada" }), COMPANY),
    true
  )
  assert.equal(
    matchesCalendarWorkOrderListQuery(row({ status: "programada" }), COMPANY),
    true
  )

  const tareasLayout = read("app/(dashboard)/tareas/layout.tsx")
  assert.match(tareasLayout, /listScope="activeWorkOrders"/)
  assert.equal(tareasLayout.includes("dashboardWorkOrders"), false)

  const archivoLayout = read("app/(dashboard)/operations/archivo-ot/layout.tsx")
  assert.match(archivoLayout, /listScope="archiveWorkOrders"/)
  assert.equal(archivoLayout.includes("dashboardWorkOrders"), false)

  const planningProviders = read(
    "components/providers/planificacion-module-providers.tsx"
  )
  assert.match(planningProviders, /listScope="planningWorkOrders"/)
  assert.equal(planningProviders.includes("dashboardWorkOrders"), false)

  const calendarProviders = read(
    "components/providers/calendar-module-providers.tsx"
  )
  assert.match(calendarProviders, /listScope="calendarWorkOrders"/)
  assert.equal(calendarProviders.includes("dashboardWorkOrders"), false)

  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")
  assert.match(load, /listDashboardWorkOrderTasks/)
  assert.match(load, /listCalendarWorkOrderTasks/)
  assert.match(load, /listPlanningWorkOrderTasks/)
  assert.match(load, /listActiveWorkOrderTasks/)
  assert.match(load, /listArchivedWorkOrderTasks/)
  assert.match(load, /listTasks\(/)
})
