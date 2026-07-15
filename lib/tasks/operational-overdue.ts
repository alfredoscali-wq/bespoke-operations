import { isDueDateBeforeToday } from "@/lib/tasks/vencida-status"
import type { Task, TaskStatus } from "@/lib/types/tasks"

/**
 * Estados vivos para los que una fecha programada pasada implica vencimiento
 * operativo (KPI / filtros), incluyendo En Curso según Control Operativo 1.0.
 */
export const OPERATIONAL_OVERDUE_ELIGIBLE_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "en-curso",
  "vencida",
]

export const OPERATIONAL_OVERDUE_EXCLUDED_STATUSES: TaskStatus[] = [
  "pendiente-cierre",
  "en-aprobacion",
  "finalizada",
  "cerrada",
  "cancelada",
  "incidencia",
]

export function isOperationallyOverdueTask(
  task: Pick<Task, "status" | "dueDate">,
  referenceDate: Date = new Date()
): boolean {
  if (OPERATIONAL_OVERDUE_EXCLUDED_STATUSES.includes(task.status)) {
    return false
  }

  if (task.status === "vencida") {
    return true
  }

  if (!OPERATIONAL_OVERDUE_ELIGIBLE_STATUSES.includes(task.status)) {
    return false
  }

  return isDueDateBeforeToday(task.dueDate, referenceDate)
}

export function filterOperationallyOverdueTasks<
  T extends Pick<Task, "status" | "dueDate">,
>(tasks: T[], referenceDate: Date = new Date()): T[] {
  return tasks.filter((task) => isOperationallyOverdueTask(task, referenceDate))
}

export function countOperationallyOverdueTasks(
  tasks: Array<Pick<Task, "status" | "dueDate">>,
  referenceDate: Date = new Date()
): number {
  return filterOperationallyOverdueTasks(tasks, referenceDate).length
}
