export const TASK_DELETE_USER_MESSAGE =
  "No fue posible eliminar la tarea. Intente nuevamente."

export const TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE =
  "No se puede archivar una tarea activa. Finalice, cierre o cancele la tarea antes de archivarla."

export const PROJECT_DELETE_USER_MESSAGE =
  "No fue posible eliminar la obra. Intente nuevamente."

export const PROJECT_ARCHIVE_BLOCKED_ACTIVE_TASKS_MESSAGE =
  "No se puede archivar la obra. Existen tareas activas asociadas. Finalice, cierre o cancele todas las tareas antes de archivar la obra."

export function logOperationError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error)
}
