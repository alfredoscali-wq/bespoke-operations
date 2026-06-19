import type { TaskStatus } from "@/lib/types/tasks"

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "en-aprobacion",
]

export const FINAL_TASK_STATUSES: TaskStatus[] = [
  "finalizada",
  "cerrada",
  "cancelada",
]

export function isActiveTaskStatus(status: TaskStatus): boolean {
  return ACTIVE_TASK_STATUSES.includes(status)
}

export function isFinalTaskStatus(status: TaskStatus): boolean {
  return FINAL_TASK_STATUSES.includes(status)
}

export function canArchiveTaskByStatus(status: TaskStatus): boolean {
  return isFinalTaskStatus(status)
}
