import type { TaskStatus } from "@/lib/types/tasks"

/**
 * OT archivadas (solo lectura). BASELINE 1.0: terminal = finalizada.
 * `cerrada` se trata como legado equivalente a finalizada.
 */
export const TASK_ARCHIVED_STATUSES: TaskStatus[] = ["finalizada", "cerrada"]

export function isTaskArchivedStatus(status: TaskStatus): boolean {
  return TASK_ARCHIVED_STATUSES.includes(status)
}

/** Normaliza filas legacy antes de usarlas en la app. */
export function normalizeTaskStatusFromDatabase(status: TaskStatus): TaskStatus {
  return status === "cerrada" ? "finalizada" : status
}
