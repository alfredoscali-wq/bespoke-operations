import type { Task, TaskStatus } from "@/lib/types/tasks"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { isTaskArchivedStatus } from "@/lib/tasks/task-archived-status"

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "vencida",
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
]

export const CANCELLABLE_TASK_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "vencida",
]

export const FINAL_TASK_STATUSES: TaskStatus[] = [
  "finalizada",
  "cancelada",
]

export function isActiveTaskStatus(status: TaskStatus): boolean {
  return ACTIVE_TASK_STATUSES.includes(status)
}

export function isCancellableTaskStatus(status: TaskStatus): boolean {
  return CANCELLABLE_TASK_STATUSES.includes(status)
}

export function isFinalTaskStatus(status: TaskStatus): boolean {
  return FINAL_TASK_STATUSES.includes(status) || isTaskArchivedStatus(status)
}

/** @deprecated Use isTaskArchivedStatus — Archivo OT es automático al finalizar. */
export function canArchiveTaskByStatus(status: TaskStatus): boolean {
  return isTaskArchivedStatus(status)
}

/** Estados excluidos del calendario operativo activo (Archivo OT + canceladas). */
export const CALENDAR_HIDDEN_TASK_STATUSES: TaskStatus[] = [
  "finalizada",
  "cancelada",
  "cerrada",
]

export function isCalendarOperationalTask(status: TaskStatus): boolean {
  return !CALENDAR_HIDDEN_TASK_STATUSES.includes(status)
}

export function filterCalendarOperationalTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => isCalendarOperationalTask(task.status))
}

export function taskRequiresSupervisorValidation(task: Pick<Task, "status">): boolean {
  return isPendingClosureStatus(task.status)
}
