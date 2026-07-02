import type { TaskStatus } from "@/lib/types/tasks"

export const WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE =
  "La Orden de Trabajo ya ingresó al circuito operativo y no puede ser modificada."

export const WORK_ORDER_ADMIN_MUTATION_BLOCKED_TOOLTIP =
  "Esta Orden de Trabajo ya ingresó al circuito operativo y no puede ser modificada por Administración."

export function canAdminModifyWorkOrder(status: TaskStatus): boolean {
  return status === "programada"
}
