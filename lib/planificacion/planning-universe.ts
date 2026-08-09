import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

/**
 * Universo de Planificación Operativa (OPS 2.0):
 * - OT de servicio (work order) existentes
 * - OT de Obra con projectId (entran como programada al iniciar / crear en active)
 *
 * Las OT de Obra en borrador NO deben llegar aquí (filtro por status en callers).
 */
export function isPlanningUniverseTask(
  task: Pick<Task, "projectCode" | "serviceType" | "projectId">
): boolean {
  if (isWorkOrderTask(task)) {
    return true
  }

  return Boolean(task.projectId?.trim())
}

/** OT de Obra visibles en Planificación (excluye borrador vía status en filters). */
export function isObraPlanningTask(
  task: Pick<Task, "projectId">
): boolean {
  return Boolean(task.projectId?.trim())
}
