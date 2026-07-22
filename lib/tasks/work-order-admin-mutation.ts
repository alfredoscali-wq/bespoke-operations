import { hasActivePlanningReturn } from "@/lib/tasks/planning-return"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export const WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE =
  "La Orden de Trabajo ya ingresó al circuito operativo y no puede ser modificada."

export const WORK_ORDER_ADMIN_MUTATION_BLOCKED_TOOLTIP =
  "Esta Orden de Trabajo ya ingresó al circuito operativo y no puede ser modificada por Administración."

export const WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_MESSAGE =
  "Las OT devueltas por planificación solo pueden reprogramarse. Use Reprogramar."

export const WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_TOOLTIP =
  "Esta OT está en Devueltas por Planificación. Solo puede ver el detalle o reprogramarla."

export function canAdminModifyWorkOrder(status: TaskStatus): boolean {
  return status === "programada"
}

/** Edición administrativa: bloqueada en la bandeja Devueltas por Planificación. */
export function canAdminModifyWorkOrderTask(
  task: Pick<Task, "status" | "taskMetadata">
): boolean {
  if (hasActivePlanningReturn(task)) {
    return false
  }

  return canAdminModifyWorkOrder(task.status)
}
