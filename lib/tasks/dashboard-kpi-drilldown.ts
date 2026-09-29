import { toDateOnly } from "@/lib/availability/utils"
import { parseTaskStatusQuery } from "@/lib/navigation/query-filters"
import { hasActivePlanningReturn } from "@/lib/tasks/planning-return"
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks/status-groups"
import { DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES } from "@/lib/tasks/task-list-scope"
import type { TaskStatus } from "@/lib/types/tasks"

export const DASHBOARD_KPI_SOURCE = "dashboard"
export const DASHBOARD_KPI_FIELD_SCOPE = "field"

/** Page size for PostgREST ranges. The full KPI set is assembled across pages. */
export const DASHBOARD_KPI_DRILLDOWN_PAGE_SIZE = 1000

export type DashboardKpiDrilldownSpec = {
  statuses: TaskStatus[]
  dueDate?: string
  fieldServiceOnly?: boolean
  excludePlanningReturn?: boolean
}

type DashboardKpiDrilldownRow = {
  status: TaskStatus
  deletedAt?: string | null
  companyId?: string | null
  dueDate?: string | null
  projectId?: string | null
  taskMetadata?: Record<string, unknown>
  code?: string
  id?: string
}

export function isDashboardKpiSource(value: string | null | undefined): boolean {
  return value === DASHBOARD_KPI_SOURCE
}

export function resolveDashboardKpiDrilldownSpec(input: {
  kpi?: string | null
  status?: string | null
  scope?: string | null
  today?: string
}): DashboardKpiDrilldownSpec | null {
  const today = input.today ?? toDateOnly()
  const kpi = input.kpi?.trim() ?? ""
  const fieldServiceOnly = input.scope === DASHBOARD_KPI_FIELD_SCOPE

  if (kpi === "pending") {
    return { statuses: [...ACTIVE_TASK_STATUSES], fieldServiceOnly }
  }

  if (kpi === "completed-today") {
    return {
      statuses: [...DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES],
      dueDate: today,
      fieldServiceOnly,
    }
  }

  if (kpi === "pending-closure-alert") {
    return {
      statuses: ["pendiente-cierre", "en-aprobacion"],
      fieldServiceOnly,
    }
  }

  const status = parseTaskStatusQuery(input.status ?? null)
  if (status === "all") {
    return null
  }

  return {
    statuses: [status],
    fieldServiceOnly,
    excludePlanningReturn: status === "vencida",
  }
}

export function matchesDashboardKpiDrilldownQuery(
  task: DashboardKpiDrilldownRow,
  spec: DashboardKpiDrilldownSpec,
  companyId?: string
): boolean {
  if (task.deletedAt) {
    return false
  }

  if (companyId && task.companyId && task.companyId !== companyId) {
    return false
  }

  if (!spec.statuses.includes(task.status)) {
    return false
  }

  if (spec.dueDate && task.dueDate !== spec.dueDate) {
    return false
  }

  if (spec.fieldServiceOnly && task.projectId) {
    return false
  }

  if (spec.excludePlanningReturn && hasActivePlanningReturn(task)) {
    return false
  }

  return true
}

export function selectDashboardKpiDrilldownRows<
  T extends DashboardKpiDrilldownRow,
>(
  rows: T[],
  spec: DashboardKpiDrilldownSpec,
  companyId?: string,
  pageSize = DASHBOARD_KPI_DRILLDOWN_PAGE_SIZE
): T[] {
  const matched = rows
    .filter((task) => matchesDashboardKpiDrilldownQuery(task, spec, companyId))
    .sort(
      (left, right) =>
        (left.dueDate ?? "").localeCompare(right.dueDate ?? "") ||
        (left.code ?? "").localeCompare(right.code ?? "") ||
        (left.id ?? "").localeCompare(right.id ?? "")
    )

  const pages: T[] = []
  for (let from = 0; from < matched.length; from += pageSize) {
    pages.push(...matched.slice(from, from + pageSize))
  }
  return pages
}

export function dashboardKpiStatusHref(status: TaskStatus): string {
  return `/tareas?source=${DASHBOARD_KPI_SOURCE}&status=${status}`
}

export function dashboardKpiFieldServiceStatusHref(status: TaskStatus): string {
  return `/tareas?source=${DASHBOARD_KPI_SOURCE}&status=${status}&scope=${DASHBOARD_KPI_FIELD_SCOPE}`
}

export function dashboardKpiPendingHref(): string {
  return `/tareas?source=${DASHBOARD_KPI_SOURCE}&kpi=pending`
}

export function dashboardKpiCompletedTodayHref(): string {
  return `/tareas?source=${DASHBOARD_KPI_SOURCE}&kpi=completed-today`
}

export function dashboardKpiPendingClosureAlertHref(): string {
  return `/tareas?source=${DASHBOARD_KPI_SOURCE}&kpi=pending-closure-alert`
}
