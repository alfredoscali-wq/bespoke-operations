export const TASK_DELETE_USER_MESSAGE =
  "No fue posible eliminar la orden de trabajo. Intente nuevamente."

export const TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE =
  "No se puede archivar una orden de trabajo activa. Finalícela o cancélela antes de consultar el archivo."

export const TASK_VENCIDA_START_BLOCKED_MESSAGE =
  "Esta orden de trabajo está vencida. Debe reprogramarla antes de iniciarla."

export const PROJECT_DELETE_USER_MESSAGE =
  "No fue posible eliminar la obra. Intente nuevamente."

export const PROJECT_ARCHIVE_BLOCKED_ACTIVE_TASKS_MESSAGE =
  "No se puede archivar la obra. Existen órdenes de trabajo activas asociadas. Finalice o cancele todas las órdenes de trabajo antes de archivar la obra."

export function logOperationError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error)
}
