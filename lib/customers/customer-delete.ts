import type { Task } from "@/lib/types/tasks"

export const CUSTOMER_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar el cliente porque posee órdenes de trabajo asociadas. Utilice la opción Archivar."

export const CUSTOMER_HAS_ISP_SERVICES_EXCLUDE_MESSAGE =
  "Este cliente tiene servicios ISP asociados. No se puede excluir desde esta lista. Use Eliminar definitivamente (administrador) o quite antes las conexiones y servicios."

type TaskCustomerRef = Pick<Task, "customerId">

export function customerHasAssociatedTasks(
  customerId: string,
  tasks: TaskCustomerRef[]
): boolean {
  return tasks.some((task) => task.customerId === customerId)
}

export function canDeleteCustomer(
  customerId: string,
  tasks: TaskCustomerRef[]
): { allowed: true } | { allowed: false; message: string } {
  if (customerHasAssociatedTasks(customerId, tasks)) {
    return {
      allowed: false,
      message: CUSTOMER_DELETE_BLOCKED_MESSAGE,
    }
  }

  return { allowed: true }
}
