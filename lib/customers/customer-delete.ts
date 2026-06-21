import type { Task } from "@/lib/types/tasks"

export const CUSTOMER_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar el cliente porque posee tareas u órdenes asociadas. Utilice la opción Archivar."

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
