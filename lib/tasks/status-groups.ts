import type { Task, TaskStatus } from "@/lib/types/tasks"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "pendiente-cierre",
  "en-aprobacion",
]

export const CANCELLABLE_TASK_STATUSES: TaskStatus[] = ["pendiente", "asignada"]

export const FINAL_TASK_STATUSES: TaskStatus[] = [
  "finalizada",
  "cerrada",
  "cancelada",
]

export function isActiveTaskStatus(status: TaskStatus): boolean {
  return ACTIVE_TASK_STATUSES.includes(status)
}

export function isCancellableTaskStatus(status: TaskStatus): boolean {
  return CANCELLABLE_TASK_STATUSES.includes(status)
}

export function isFinalTaskStatus(status: TaskStatus): boolean {
  return FINAL_TASK_STATUSES.includes(status)
}

export function canArchiveTaskByStatus(status: TaskStatus): boolean {
  return isFinalTaskStatus(status)
}

/** Terminal statuses excluded from calendar views. */
export const CALENDAR_HIDDEN_TASK_STATUSES: TaskStatus[] = [
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
