import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildDayOperations,
  buildExecutiveSummary,
  buildTasksStatusKpis,
  countWorkOrdersPendingClosure,
  countWorkOrdersWithIncidents,
} from "../lib/data/dashboard.ts"
import { getTasksSummary } from "../lib/data/tasks.ts"
import { PLANNING_RETURN_METADATA_KEYS } from "../lib/tasks/planning-return.ts"
import { ACTIVE_TASK_STATUSES } from "../lib/tasks/status-groups.ts"
import {
  DASHBOARD_KPI_DRILLDOWN_PAGE_SIZE,
  DASHBOARD_KPI_FIELD_SCOPE,
  DASHBOARD_KPI_SOURCE,
  dashboardKpiCompletedTodayHref,
  dashboardKpiFieldServiceStatusHref,
  dashboardKpiPendingClosureAlertHref,
  dashboardKpiPendingHref,
  dashboardKpiStatusHref,
  matchesDashboardKpiDrilldownQuery,
  resolveDashboardKpiDrilldownSpec,
  selectDashboardKpiDrilldownRows,
} from "../lib/tasks/dashboard-kpi-drilldown.ts"
import { matchesActiveWorkOrderListQuery } from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY = "00000000-0000-4000-8000-000000000001"
const TODAY = "2026-09-18"

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function kpiQuerySource() {
  const queries = read("lib/supabase/tasks.queries.ts")
  return queries.slice(
    queries.indexOf("export async function fetchDashboardKpiDrilldownTasks("),
    queries.indexOf("export async function fetchWorkOrdersByCustomerId(")
  )
}

function row(overrides = {}) {
  return {
    id: overrides.id ?? overrides.code ?? "ot",
    code: overrides.code ?? "OT-1",
    status: overrides.status ?? "vencida",
    projectId: overrides.projectId ?? null,
    deletedAt: overrides.deletedAt ?? null,
    companyId: overrides.companyId ?? COMPANY,
    dueDate: overrides.dueDate ?? "2026-09-01",
    title: overrides.title ?? overrides.code ?? "OT-1",
    taskMetadata: overrides.taskMetadata ?? {},
  }
}

function planningReturnMeta() {
  return {
    [PLANNING_RETURN_METADATA_KEYS.reason]: "Cliente ausente",
    [PLANNING_RETURN_METADATA_KEYS.at]: "2026-09-17T12:00:00.000Z",
    [PLANNING_RETURN_METADATA_KEYS.by]: "Planificación",
  }
}

test("KPI drill-down query is dedicated, paged, and isolated", () => {
  const block = kpiQuerySource()

  assert.match(block, /\.eq\("company_id", companyId\)/)
  assert.match(block, /\.is\("deleted_at", null\)/)
  assert.match(block, /DASHBOARD_KPI_DRILLDOWN_PAGE_SIZE/)
  assert.match(block, /\.range\(from, from \+ DASHBOARD_KPI_DRILLDOWN_PAGE_SIZE - 1\)/)
  assert.equal(block.includes("fetchTasks("), false)
  assert.equal(block.includes("fetchActiveWorkOrderListTasks"), false)
  assert.equal(
    block.includes("ACTIVE_WORK_ORDER_LIST") ||
      block.includes("filterActiveWorkOrders"),
    false
  )
})

test("KPI vencidas y el drill-down usan el mismo universo, con y sin obra", () => {
  const fieldVencida = row({
    id: "field-vencida",
    code: "TSK-OT-1",
    status: "vencida",
    projectId: null,
  })
  const obraVencida = row({
    id: "obra-vencida",
    code: "TSK-OB-1",
    status: "vencida",
    projectId: "obra-1",
  })
  const otherCompany = row({
    id: "other-co",
    code: "TSK-OT-X",
    status: "vencida",
    companyId: OTHER_COMPANY,
  })
  const deleted = row({
    id: "deleted",
    code: "TSK-OT-DEL",
    status: "vencida",
    deletedAt: "2026-09-18T00:00:00.000Z",
  })
  const returned = row({
    id: "returned",
    code: "TSK-OT-RET",
    status: "vencida",
    taskMetadata: planningReturnMeta(),
  })
  const asignada = row({
    id: "asig",
    code: "TSK-OT-A",
    status: "asignada",
  })

  const universe = [
    fieldVencida,
    obraVencida,
    otherCompany,
    deleted,
    returned,
    asignada,
  ]
  const kpiCount = getTasksSummary(
    universe.filter(
      (task) =>
        !task.deletedAt &&
        task.companyId === COMPANY
    )
  ).vencida

  const spec = resolveDashboardKpiDrilldownSpec({
    status: "vencida",
    today: TODAY,
  })
  assert.ok(spec)
  assert.equal(spec.excludePlanningReturn, true)

  const listed = selectDashboardKpiDrilldownRows(universe, spec, COMPANY)
  assert.equal(kpiCount, 2)
  assert.equal(listed.length, kpiCount)
  assert.deepEqual(
    listed.map((task) => task.id).sort(),
    ["field-vencida", "obra-vencida"]
  )

  assert.equal(dashboardKpiStatusHref("vencida"), `/tareas?source=${DASHBOARD_KPI_SOURCE}&status=vencida`)
  assert.equal(
    buildTasksStatusKpis(
      universe.filter((task) => !task.deletedAt && task.companyId === COMPANY)
    ).find((kpi) => kpi.id === "vencida")?.href,
    dashboardKpiStatusHref("vencida")
  )
})

test("el listado activo de /tareas no es el universo del KPI vencidas", () => {
  const obraVencida = row({
    id: "obra-vencida",
    status: "vencida",
    projectId: "obra-1",
  })
  assert.equal(matchesActiveWorkOrderListQuery(obraVencida), false)
  assert.equal(
    matchesDashboardKpiDrilldownQuery(
      obraVencida,
      { statuses: ["vencida"], excludePlanningReturn: true },
      COMPANY
    ),
    true
  )
})

test("drill-down no depende de un tope único de 1000", () => {
  const many = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `vencida-${index}`,
      code: `TSK-V-${String(index).padStart(4, "0")}`,
      status: "vencida",
    })
  )
  const spec = { statuses: ["vencida"], excludePlanningReturn: true }
  const listed = selectDashboardKpiDrilldownRows(many, spec, COMPANY)
  assert.equal(listed.length, 1100)
  assert.equal(DASHBOARD_KPI_DRILLDOWN_PAGE_SIZE, 1000)
})

test("Pendientes, programadas, asignadas, en curso y finalizadas incluyen Obras", () => {
  const obraProgramada = row({
    id: "obra-prog",
    status: "programada",
    projectId: "obra-1",
  })
  const fieldProgramada = row({
    id: "field-prog",
    status: "programada",
    projectId: null,
  })

  const pendingSpec = resolveDashboardKpiDrilldownSpec({
    kpi: "pending",
    today: TODAY,
  })
  assert.deepEqual(pendingSpec?.statuses, [...ACTIVE_TASK_STATUSES])
  assert.equal(
    matchesDashboardKpiDrilldownQuery(obraProgramada, pendingSpec, COMPANY),
    true
  )
  assert.equal(dashboardKpiPendingHref(), `/tareas?source=${DASHBOARD_KPI_SOURCE}&kpi=pending`)

  for (const status of ["programada", "asignada", "en-curso", "finalizada"]) {
    const spec = resolveDashboardKpiDrilldownSpec({ status, today: TODAY })
    assert.equal(
      matchesDashboardKpiDrilldownQuery(
        row({ id: `obra-${status}`, status, projectId: "obra-1" }),
        spec,
        COMPANY
      ),
      true
    )
    assert.equal(
      matchesDashboardKpiDrilldownQuery(
        row({ id: `field-${status}`, status, projectId: null }),
        spec,
        COMPANY
      ),
      true
    )
    assert.equal(
      buildTasksStatusKpis([
        row({ id: `obra-${status}`, status, projectId: "obra-1" }),
        row({ id: `field-${status}`, status, projectId: null }),
      ]).find((kpi) => kpi.id === status || (status === "en-curso" && kpi.id === "en-curso"))
        ?.href,
      dashboardKpiStatusHref(status)
    )
  }

  assert.equal(
    selectDashboardKpiDrilldownRows(
      [obraProgramada, fieldProgramada, row({ status: "programada", companyId: OTHER_COMPANY })],
      { statuses: ["programada"] },
      COMPANY
    ).length,
    2
  )
})

test("KPI de incidencias y pendientes de cierre de campo coinciden con scope=field", () => {
  const fieldIncident = row({
    id: "field-inc",
    status: "incidencia",
    projectId: null,
  })
  const obraIncident = row({
    id: "obra-inc",
    status: "incidencia",
    projectId: "obra-1",
  })
  const fieldPending = row({
    id: "field-pc",
    status: "pendiente-cierre",
    projectId: null,
  })
  const obraPending = row({
    id: "obra-pc",
    status: "pendiente-cierre",
    projectId: "obra-1",
  })
  const tasks = [fieldIncident, obraIncident, fieldPending, obraPending]

  assert.equal(countWorkOrdersWithIncidents(tasks), 1)
  assert.equal(countWorkOrdersPendingClosure(tasks), 1)

  const incidentSpec = resolveDashboardKpiDrilldownSpec({
    status: "incidencia",
    scope: DASHBOARD_KPI_FIELD_SCOPE,
    today: TODAY,
  })
  const closureSpec = resolveDashboardKpiDrilldownSpec({
    status: "pendiente-cierre",
    scope: DASHBOARD_KPI_FIELD_SCOPE,
    today: TODAY,
  })

  assert.equal(
    selectDashboardKpiDrilldownRows(tasks, incidentSpec, COMPANY).length,
    1
  )
  assert.equal(
    selectDashboardKpiDrilldownRows(tasks, closureSpec, COMPANY).length,
    1
  )
  assert.equal(
    buildTasksStatusKpis(tasks).find((kpi) => kpi.id === "incidencia")?.href,
    dashboardKpiFieldServiceStatusHref("incidencia")
  )
  assert.equal(
    buildTasksStatusKpis(tasks).find((kpi) => kpi.id === "pendiente-cierre")?.href,
    dashboardKpiFieldServiceStatusHref("pendiente-cierre")
  )
})

test("alerta de pendiente de cierre incluye Obras y en-aprobacion", () => {
  const spec = resolveDashboardKpiDrilldownSpec({
    kpi: "pending-closure-alert",
    today: TODAY,
  })
  assert.deepEqual(spec?.statuses, ["pendiente-cierre", "en-aprobacion"])
  assert.equal(
    matchesDashboardKpiDrilldownQuery(
      row({ status: "en-aprobacion", projectId: "obra-1" }),
      spec,
      COMPANY
    ),
    true
  )
  assert.equal(
    dashboardKpiPendingClosureAlertHref(),
    `/tareas?source=${DASHBOARD_KPI_SOURCE}&kpi=pending-closure-alert`
  )
})

test("Finalizadas hoy usa due_date de hoy e incluye Obras", () => {
  const spec = resolveDashboardKpiDrilldownSpec({
    kpi: "completed-today",
    today: TODAY,
  })
  const metrics = buildDayOperations({
    tasks: [
      row({
        id: "today-obra",
        status: "finalizada",
        projectId: "obra-1",
        dueDate: TODAY,
      }),
      row({
        id: "today-field",
        status: "finalizada",
        projectId: null,
        dueDate: TODAY,
      }),
      row({
        id: "yesterday",
        status: "finalizada",
        dueDate: "2026-09-17",
      }),
    ],
    evidence: [],
    referenceDate: TODAY,
  })
  const completed = metrics.find((item) => item.id === "completed-today")
  assert.equal(completed?.value, 2)
  assert.equal(
    selectDashboardKpiDrilldownRows(
      [
        row({
          id: "today-obra",
          status: "finalizada",
          projectId: "obra-1",
          dueDate: TODAY,
        }),
        row({
          id: "today-field",
          status: "finalizada",
          dueDate: TODAY,
        }),
        row({
          id: "yesterday",
          status: "finalizada",
          dueDate: "2026-09-17",
        }),
      ],
      spec,
      COMPANY
    ).length,
    2
  )
  assert.equal(
    dashboardKpiCompletedTodayHref(),
    `/tareas?source=${DASHBOARD_KPI_SOURCE}&kpi=completed-today`
  )
})

test("layout de /tareas usa el scope de KPI cuando source=dashboard", () => {
  const layout = read("app/(dashboard)/tareas/layout.tsx")
  const providers = read("components/tareas/tareas-list-scope-providers.tsx")
  const moduleSource = read("components/tareas/tasks-module.tsx")
  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")

  assert.match(layout, /TareasListScopeProvidersBoundary/)
  assert.match(providers, /dashboardKpiWorkOrders/)
  assert.match(load, /listDashboardKpiDrilldownTasks/)
  assert.match(moduleSource, /isDashboardKpiSource/)
  assert.match(moduleSource, /showDashboardKpiColumns/)
  assert.equal(load.includes("fetchTasks("), false)
})

test("Pendientes del ejecutivo coincide con kpi=pending", () => {
  const tasks = [
    row({ id: "p1", status: "programada" }),
    row({ id: "p2", status: "vencida", projectId: "obra-1" }),
    row({ id: "p3", status: "finalizada" }),
  ]
  const summary = buildExecutiveSummary({
    projects: [],
    tasks,
    crews: [],
    alertsCount: 0,
    crewAvailabilityContext: { availabilityRecords: [] },
  })
  const pending = summary.find((item) => item.id === "pending-tasks")
  assert.equal(pending?.value, "2")
  assert.equal(pending?.href, dashboardKpiPendingHref())
})
