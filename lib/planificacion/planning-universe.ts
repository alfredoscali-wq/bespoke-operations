import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

/**
 * Universo de Planificación (OPS 2.0+):
 * - OT de servicio (work order)
 * - OT de Obra con projectId
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

/** OT de Obra (project_id set). OPS 2.1B: fuera de ruta / execution_order / dispatch_order. */
export function isObraPlanningTask(task: Pick<Task, "projectId">): boolean {
  return Boolean(task.projectId?.trim())
}

/**
 * OT operativas de ruta diaria (instalaciones, service, bajas, etc.).
 * OPS 2.1B: únicas que usan execution_order / dispatch_order / Planificar.
 */
export function isOperationalRouteTask(
  task: Pick<Task, "projectCode" | "serviceType" | "projectId">
): boolean {
  return isPlanningUniverseTask(task) && !isObraPlanningTask(task)
}
