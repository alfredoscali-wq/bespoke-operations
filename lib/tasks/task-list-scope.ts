import type { TaskStatus } from "@/lib/types/tasks"

/** Estados incluidos en Archivo / Historial Operativo de OT. */
export const ARCHIVE_WORK_ORDER_STATUSES: TaskStatus[] = [
  "finalizada",
  "cancelada",
  "pendiente-cierre",
]

/** @deprecated Prefer ARCHIVE_WORK_ORDER_STATUSES — kept for finalizada-only checks. */
export const ARCHIVE_WORK_ORDER_STATUS = "finalizada" as const satisfies TaskStatus

/** Estado único del listado Archivo (`/operations/archivo-ot`). */
export const ARCHIVE_WORK_ORDER_LIST_STATUS =
  "finalizada" as const satisfies TaskStatus

export type ArchiveOtStatusFilter =
  | "all"
  | "finalizada"
  | "cancelada"
  | "pendiente-cierre"
  | "archivadas"

export const ARCHIVE_OT_STATUS_FILTER_OPTIONS: Array<{
  value: ArchiveOtStatusFilter
  label: string
}> = [
  { value: "all", label: "Todas" },
  { value: "finalizada", label: "Finalizadas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "pendiente-cierre", label: "Pendientes de cierre" },
  { value: "archivadas", label: "Archivadas" },
]

/** OT visibles en Órdenes de Trabajo (trabajo operativo activo). */
export const ACTIVE_WORK_ORDER_LIST_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "en-curso",
  "pendiente-cierre",
  "vencida",
]

export function isActiveWorkOrderListStatus(status: TaskStatus): boolean {
  return ACTIVE_WORK_ORDER_LIST_STATUSES.includes(status)
}

/** OT que el read model de Planificación espera en sourceTasks. */
export const PLANNING_WORK_ORDER_LIST_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "en-curso",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
]

type ActiveWorkOrderListRow = {
  status: TaskStatus
  projectId?: string | null
  deletedAt?: string | null
  dueDate: string
  code?: string
}

/**
 * Server-side predicate for the Órdenes de Trabajo active list query.
 * Matches fetchActiveWorkOrderListTasks filters (not fetchTasks).
 */
export function matchesActiveWorkOrderListQuery(
  task: Pick<ActiveWorkOrderListRow, "status" | "projectId" | "deletedAt">
): boolean {
  if (task.deletedAt) {
    return false
  }

  return (
    isTareasModuleWorkOrder(task) && isActiveWorkOrderListStatus(task.status)
  )
}

/**
 * Applies the active OT list query semantics, then the PostgREST max_rows cap.
 * Used to prove recent operational OTs are not displaced by historical rows.
 */
export function selectActiveWorkOrderListRows<T extends ActiveWorkOrderListRow>(
  rows: T[],
  maxRows = 1000
): T[] {
  return rows
    .filter(matchesActiveWorkOrderListQuery)
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        (left.code ?? "").localeCompare(right.code ?? "")
    )
    .slice(0, maxRows)
}

export function isPlanningWorkOrderListStatus(status: TaskStatus): boolean {
  return PLANNING_WORK_ORDER_LIST_STATUSES.includes(status)
}

type PlanningWorkOrderListRow = {
  status: TaskStatus
  deletedAt?: string | null
  companyId?: string | null
  dueDate: string
  code?: string
  projectId?: string | null
}

/**
 * Server-side predicate for Planificación. Matches fetchPlanningWorkOrderListTasks:
 * operational statuses only, not soft-deleted. Includes Obras (project_id set)
 * because buildPlanningReadModel still needs them for the Obras lane and
 * pendiente-cierre sheet.
 */
export function matchesPlanningWorkOrderListQuery(
  task: Pick<
    PlanningWorkOrderListRow,
    "status" | "deletedAt" | "companyId"
  >,
  companyId?: string
): boolean {
  if (task.deletedAt) {
    return false
  }

  if (companyId && task.companyId && task.companyId !== companyId) {
    return false
  }

  return isPlanningWorkOrderListStatus(task.status)
}

export function selectPlanningWorkOrderListRows<
  T extends PlanningWorkOrderListRow,
>(rows: T[], companyId?: string, maxRows = 1000): T[] {
  return rows
    .filter((task) => matchesPlanningWorkOrderListQuery(task, companyId))
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        (left.code ?? "").localeCompare(right.code ?? "")
    )
    .slice(0, maxRows)
}

/** OT operativas del Calendario (`/operations/calendar`). Independent of planningWorkOrders. */
export const CALENDAR_WORK_ORDER_LIST_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "en-curso",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
]

export function isCalendarWorkOrderListStatus(status: TaskStatus): boolean {
  return CALENDAR_WORK_ORDER_LIST_STATUSES.includes(status)
}

type CalendarWorkOrderListRow = {
  status: TaskStatus
  deletedAt?: string | null
  companyId?: string | null
  dueDate: string
  code?: string
  projectId?: string | null
}

/**
 * Server-side predicate for Calendario. Matches fetchCalendarWorkOrderListTasks:
 * operational statuses only, not soft-deleted. Includes Obras (project_id set)
 * because the Obras view, projectId filter, and Todos/Operaciones grid still
 * need them.
 */
export function matchesCalendarWorkOrderListQuery(
  task: Pick<
    CalendarWorkOrderListRow,
    "status" | "deletedAt" | "companyId"
  >,
  companyId?: string
): boolean {
  if (task.deletedAt) {
    return false
  }

  if (companyId && task.companyId && task.companyId !== companyId) {
    return false
  }

  return isCalendarWorkOrderListStatus(task.status)
}

export function selectCalendarWorkOrderListRows<
  T extends CalendarWorkOrderListRow,
>(rows: T[], companyId?: string, maxRows = 1000): T[] {
  return rows
    .filter((task) => matchesCalendarWorkOrderListQuery(task, companyId))
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        (left.code ?? "").localeCompare(right.code ?? "")
    )
    .slice(0, maxRows)
}

/**
 * OT operativas del Dashboard (`/`). Independent of planning/calendar scopes.
 * Includes `borrador` because buildExecutiveSummary Pendientes uses
 * ACTIVE_TASK_STATUSES, which counts drafts.
 */
export const DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES: TaskStatus[] = [
  "borrador",
  "programada",
  "asignada",
  "en-curso",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
]

/**
 * Statuses counted as "finalizadas hoy" by buildDayOperations / isTaskCompletedToday:
 * dueDate === today. Independent of the all-time "Finalizadas" KPI.
 */
export const DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES: TaskStatus[] = [
  "finalizada",
  "cerrada",
]

/**
 * KPI "Finalizadas" (Estado de OT): COUNT of status === "finalizada" with no
 * date filter. Same predicate as getTasksSummary.finalizada. Never loads rows.
 */
export const DASHBOARD_FINALIZADA_COUNT_STATUS =
  "finalizada" as const satisfies TaskStatus

/**
 * Recent-activity feed candidates. Same set as FINAL_TASK_STATUSES used by
 * buildRecentOperationalActivity. Ordered by created_at, limited in SQL.
 */
export const DASHBOARD_RECENT_ACTIVITY_WORK_ORDER_LIST_STATUSES: TaskStatus[] = [
  "finalizada",
  "cancelada",
]

/** Matches buildRecentOperationalActivity default `limit ?? 10`. */
export const DASHBOARD_RECENT_ACTIVITY_LIMIT = 10

/**
 * Historical completed OT of Obras. Needed by buildProjectOperationalMetricsMap
 * (isTaskArchivedStatus = finalizada | cerrada). Operational obra tasks already
 * come from the live operational query.
 */
export const DASHBOARD_PROJECT_METRIC_COMPLETED_STATUSES: TaskStatus[] = [
  "finalizada",
  "cerrada",
]

/** PostgREST max_rows page size for the project-metrics completed query. */
export const DASHBOARD_PROJECT_METRIC_PAGE_SIZE = 1000

export function isDashboardOperationalWorkOrderListStatus(
  status: TaskStatus
): boolean {
  return DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES.includes(status)
}

export function isDashboardCompletedTodayWorkOrderListStatus(
  status: TaskStatus
): boolean {
  return DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES.includes(status)
}

type DashboardWorkOrderListRow = {
  id?: string
  status: TaskStatus
  deletedAt?: string | null
  companyId?: string | null
  dueDate: string
  code?: string
  projectId?: string | null
  createdAt?: string | null
}

function isDashboardTenantRow(
  task: Pick<DashboardWorkOrderListRow, "deletedAt" | "companyId">,
  companyId?: string
): boolean {
  if (task.deletedAt) {
    return false
  }

  if (companyId && task.companyId && task.companyId !== companyId) {
    return false
  }

  return true
}

/**
 * Server-side predicate for Dashboard. Matches fetchDashboardWorkOrderListTasks:
 * all live operational statuses (including borrador), plus finalizada/cerrada
 * only when due_date is the dashboard "today" string (same field as
 * isTaskCompletedToday). Includes Obras (project_id set) for overdue-obra
 * alerts. Historical finalizada/cancelada are NOT in this payload.
 */
export function matchesDashboardWorkOrderListQuery(
  task: Pick<
    DashboardWorkOrderListRow,
    "status" | "deletedAt" | "companyId" | "dueDate"
  >,
  companyId: string | undefined,
  today: string
): boolean {
  if (!isDashboardTenantRow(task, companyId)) {
    return false
  }

  if (isDashboardOperationalWorkOrderListStatus(task.status)) {
    return true
  }

  return (
    isDashboardCompletedTodayWorkOrderListStatus(task.status) &&
    task.dueDate === today
  )
}

export function selectDashboardWorkOrderListRows<
  T extends DashboardWorkOrderListRow,
>(rows: T[], companyId: string | undefined, today: string, maxRows = 1000): T[] {
  return rows
    .filter((task) => matchesDashboardWorkOrderListQuery(task, companyId, today))
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        (left.code ?? "").localeCompare(right.code ?? "")
    )
    .slice(0, maxRows)
}

/**
 * COUNT predicate for KPI "Finalizadas": status === "finalizada", no date
 * filter. Matches getTasksSummary.finalizada. Does not apply max_rows.
 */
export function matchesDashboardFinalizadaCountQuery(
  task: Pick<DashboardWorkOrderListRow, "status" | "deletedAt" | "companyId">,
  companyId?: string
): boolean {
  return (
    isDashboardTenantRow(task, companyId) &&
    task.status === DASHBOARD_FINALIZADA_COUNT_STATUS
  )
}

export function countDashboardFinalizadaRows<
  T extends Pick<DashboardWorkOrderListRow, "status" | "deletedAt" | "companyId">,
>(rows: T[], companyId?: string): number {
  return rows.filter((task) =>
    matchesDashboardFinalizadaCountQuery(task, companyId)
  ).length
}

export function isDashboardRecentActivityWorkOrderListStatus(
  status: TaskStatus
): boolean {
  return DASHBOARD_RECENT_ACTIVITY_WORK_ORDER_LIST_STATUSES.includes(status)
}

export function matchesDashboardRecentActivityQuery(
  task: Pick<DashboardWorkOrderListRow, "status" | "deletedAt" | "companyId">,
  companyId?: string
): boolean {
  return (
    isDashboardTenantRow(task, companyId) &&
    isDashboardRecentActivityWorkOrderListStatus(task.status)
  )
}

function dashboardRecentActivityTimestamp(task: {
  createdAt?: string | null
  dueDate: string
}): number {
  const timestamp = task.createdAt ?? `${task.dueDate}T18:00:00`
  return new Date(timestamp).getTime()
}

/**
 * Same candidate set and sort as buildRecentOperationalActivity task events,
 * limited in SQL to the feed size so historical finals are not loaded.
 */
export function selectDashboardRecentActivityRows<
  T extends DashboardWorkOrderListRow,
>(
  rows: T[],
  companyId: string | undefined,
  limit = DASHBOARD_RECENT_ACTIVITY_LIMIT
): T[] {
  return rows
    .filter((task) => matchesDashboardRecentActivityQuery(task, companyId))
    .sort(
      (left, right) =>
        dashboardRecentActivityTimestamp(right) -
        dashboardRecentActivityTimestamp(left)
    )
    .slice(0, limit)
}

export function isDashboardProjectMetricCompletedStatus(
  status: TaskStatus
): boolean {
  return DASHBOARD_PROJECT_METRIC_COMPLETED_STATUSES.includes(status)
}

export function matchesDashboardProjectMetricCompletedQuery(
  task: Pick<
    DashboardWorkOrderListRow,
    "status" | "deletedAt" | "companyId" | "projectId"
  >,
  companyId?: string
): boolean {
  if (!isDashboardTenantRow(task, companyId)) {
    return false
  }

  if (!task.projectId) {
    return false
  }

  return isDashboardProjectMetricCompletedStatus(task.status)
}

export function selectDashboardProjectMetricCompletedRows<
  T extends DashboardWorkOrderListRow,
>(rows: T[], companyId?: string, pageSize = DASHBOARD_PROJECT_METRIC_PAGE_SIZE): T[] {
  const matched = rows
    .filter((task) =>
      matchesDashboardProjectMetricCompletedQuery(task, companyId)
    )
    .sort(
      (left, right) =>
        (left.id ?? left.code ?? "").localeCompare(right.id ?? right.code ?? "")
    )

  const pages: T[] = []
  for (let from = 0; from < matched.length; from += pageSize) {
    pages.push(...matched.slice(from, from + pageSize))
  }
  return pages
}

export function isArchiveWorkOrderStatus(status: TaskStatus): boolean {
  return ARCHIVE_WORK_ORDER_STATUSES.includes(status)
}

/**
 * Server-side predicate for Archivo. Matches fetchArchivedWorkOrderListTasks:
 * finalizada, without project, not soft-deleted.
 */
export function matchesArchivedWorkOrderListQuery(task: {
  status: TaskStatus
  projectId?: string | null
  deletedAt?: string | null
}): boolean {
  if (task.deletedAt) {
    return false
  }

  return (
    isTareasModuleWorkOrder(task) &&
    task.status === ARCHIVE_WORK_ORDER_LIST_STATUS
  )
}

/** OT de Obra viven en Obras + Planificación, no en el módulo Órdenes de Trabajo. */
export function isTareasModuleWorkOrder(task: {
  projectId?: string | null
}): boolean {
  return !task.projectId
}

export function filterActiveWorkOrders<
  T extends { status: TaskStatus; projectId?: string | null },
>(tasks: T[]): T[] {
  return tasks.filter(
    (task) =>
      isTareasModuleWorkOrder(task) && isActiveWorkOrderListStatus(task.status)
  )
}

export function filterArchivedWorkOrders<
  T extends {
    status: TaskStatus
    projectId?: string | null
    deletedAt?: string | null
  },
>(tasks: T[], _statusFilter: ArchiveOtStatusFilter = "all"): T[] {
  return tasks.filter(matchesArchivedWorkOrderListQuery)
}
