import type { SupabaseAdminClient } from "@/lib/supabase/admin"
import { isTaskArchivedStatus } from "@/lib/tasks/task-archived-status"
import { WORK_ORDER_PERMANENT_DELETE_ARCHIVED_ONLY_MESSAGE } from "@/lib/tasks/work-order-deletion-policy"
import type { TaskStatus } from "@/lib/types/tasks"

import {
  isPermanentDeleteImplemented,
  type PermanentDeleteEntityType,
} from "@/lib/admin/permanent-delete-types"

export const PERMANENT_DELETE_ADMIN_ONLY_MESSAGE =
  "Solo un administrador del sistema puede eliminar definitivamente un registro."

export const PERMANENT_DELETE_NOT_IMPLEMENTED_MESSAGE =
  "La eliminación definitiva de este tipo de entidad aún no está disponible."

export const PERMANENT_DELETE_CUSTOMER_BLOCKED_MESSAGE =
  "No se puede eliminar definitivamente un cliente con órdenes de trabajo activas en el circuito operativo."

export const PERMANENT_DELETE_EMPLOYEE_BLOCKED_MESSAGE =
  "No se puede eliminar definitivamente un empleado con historial operativo."

export function canShowPermanentDeleteAction(
  systemRole: string | null | undefined
): boolean {
  return systemRole === "administrador"
}

export function assertPermanentDeleteEntityImplemented(
  entityType: PermanentDeleteEntityType
): void {
  if (!isPermanentDeleteImplemented(entityType)) {
    throw new Error(PERMANENT_DELETE_NOT_IMPLEMENTED_MESSAGE)
  }
}

export async function assertTaskPermanentDeleteAllowed(
  client: SupabaseAdminClient,
  taskId: string
): Promise<{ status: TaskStatus }> {
  const { data: task, error } = await client
    .from("tasks")
    .select("status")
    .eq("id", taskId)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo leer la orden de trabajo: ${error.message}`)
  }

  if (!task) {
    throw new Error("Orden de trabajo no encontrada.")
  }

  const status = task.status as TaskStatus

  if (!isTaskArchivedStatus(status)) {
    throw new Error(WORK_ORDER_PERMANENT_DELETE_ARCHIVED_ONLY_MESSAGE)
  }

  return { status }
}

export async function assertCustomerPermanentDeleteAllowed(
  client: SupabaseAdminClient,
  customerId: string
): Promise<void> {
  const { data: tasks, error } = await client
    .from("tasks")
    .select("id, status")
    .eq("customer_id", customerId)
    .is("deleted_at", null)

  if (error) {
    throw new Error(
      `No se pudieron leer órdenes de trabajo del cliente: ${error.message}`
    )
  }

  const hasActiveOperationalTasks = (tasks ?? []).some((task) => {
    const status = task.status as TaskStatus
    return status !== "cancelada" && !isTaskArchivedStatus(status)
  })

  if (hasActiveOperationalTasks) {
    throw new Error(PERMANENT_DELETE_CUSTOMER_BLOCKED_MESSAGE)
  }
}
