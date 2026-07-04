import type { TaskStatus } from "@/lib/types/tasks"

/** OT visibles en Órdenes de Trabajo (trabajo operativo activo). */
export const ACTIVE_WORK_ORDER_LIST_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "en-curso",
  "pendiente-cierre",
]

export const ARCHIVE_WORK_ORDER_STATUS = "finalizada" as const satisfies TaskStatus

export function isActiveWorkOrderListStatus(status: TaskStatus): boolean {
  return ACTIVE_WORK_ORDER_LIST_STATUSES.includes(status)
}

export function filterActiveWorkOrders<T extends { status: TaskStatus }>(
  tasks: T[]
): T[] {
  return tasks.filter((task) => isActiveWorkOrderListStatus(task.status))
}

export function filterArchivedWorkOrders<T extends { status: TaskStatus }>(
  tasks: T[]
): T[] {
  return tasks.filter((task) => task.status === ARCHIVE_WORK_ORDER_STATUS)
}
