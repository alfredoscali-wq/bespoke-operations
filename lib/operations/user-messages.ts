export const TASK_DELETE_USER_MESSAGE =
  "No fue posible eliminar la tarea. Intente nuevamente."

export const PROJECT_DELETE_USER_MESSAGE =
  "No fue posible eliminar la obra. Intente nuevamente."

export function logOperationError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error)
}
