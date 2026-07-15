import type { TaskStatus } from "@/lib/types/tasks"

/** Estados incluidos en Archivo / Historial Operativo de OT. */
export const ARCHIVE_WORK_ORDER_STATUSES: TaskStatus[] = [
  "finalizada",
  "cancelada",
  "pendiente-cierre",
]

/** @deprecated Prefer ARCHIVE_WORK_ORDER_STATUSES — kept for finalizada-only checks. */
export const ARCHIVE_WORK_ORDER_STATUS = "finalizada" as const satisfies TaskStatus

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

export function isArchiveWorkOrderStatus(status: TaskStatus): boolean {
  return ARCHIVE_WORK_ORDER_STATUSES.includes(status)
}

export function filterActiveWorkOrders<T extends { status: TaskStatus }>(
  tasks: T[]
): T[] {
  return tasks.filter((task) => isActiveWorkOrderListStatus(task.status))
}

export function filterArchivedWorkOrders<T extends { status: TaskStatus }>(
  tasks: T[],
  statusFilter: ArchiveOtStatusFilter = "all"
): T[] {
  const inArchive = tasks.filter((task) => isArchiveWorkOrderStatus(task.status))

  switch (statusFilter) {
    case "finalizada":
      return inArchive.filter((task) => task.status === "finalizada")
    case "cancelada":
      return inArchive.filter((task) => task.status === "cancelada")
    case "pendiente-cierre":
      return inArchive.filter((task) => task.status === "pendiente-cierre")
    case "archivadas":
      return inArchive.filter((task) => task.status === "finalizada")
    case "all":
    default:
      return inArchive
  }
}
