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
