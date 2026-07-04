import "server-only"

import {
  fetchTaskById,
  patchTask,
  softDeleteWorkOrderFromAdmin,
  type SupabaseTasksClient,
} from "@/lib/supabase/tasks.queries"
import {
  canAdminModifyWorkOrder,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-admin-mutation"
import type { Task } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { SessionUser } from "@/lib/auth/session"

export class WorkOrderAdminMutationError extends Error {
  readonly httpStatus: number

  constructor(message: string, httpStatus: number) {
    super(message)
    this.name = "WorkOrderAdminMutationError"
    this.httpStatus = httpStatus
  }
}

function assertAdminWorkOrderMutable(status: Task["status"]): void {
  if (!canAdminModifyWorkOrder(status)) {
    throw new WorkOrderAdminMutationError(
      WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
      409
    )
  }
}

function assertWritableAdminRole(sessionUser: SessionUser): void {
  if (sessionUser.systemRole === "operario") {
    throw new WorkOrderAdminMutationError(
      "Su perfil no puede modificar órdenes de trabajo desde administración.",
      403
    )
  }
}

async function fetchTaskForAdminMutation(
  client: SupabaseTasksClient,
  taskId: string
): Promise<Task> {
  const result = await fetchTaskById(client, taskId)

  if (result.error || !result.data) {
    throw new WorkOrderAdminMutationError(
      result.error?.message ?? "Orden de trabajo no encontrada.",
      404
    )
  }

  return result.data
}

export async function updateWorkOrderFromAdmin(
  client: SupabaseTasksClient,
  taskId: string,
  payload: UpdateTaskPayload,
  sessionUser: SessionUser
): Promise<Task> {
  assertWritableAdminRole(sessionUser)
  const existing = await fetchTaskForAdminMutation(client, taskId)
  assertAdminWorkOrderMutable(existing.status)

  const { status: _status, ...fieldsOnly } = payload
  const result = await patchTask(client, taskId, fieldsOnly)

  if (result.error || !result.data) {
    throw new WorkOrderAdminMutationError(
      result.error?.message ??
        "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
      result.error?.code === "CONFLICT" ? 409 : 500
    )
  }

  return result.data
}

export async function deleteWorkOrderFromAdmin(
  client: SupabaseTasksClient,
  taskId: string,
  sessionUser: SessionUser
): Promise<void> {
  assertWritableAdminRole(sessionUser)
  const existing = await fetchTaskForAdminMutation(client, taskId)
  assertAdminWorkOrderMutable(existing.status)

  const result = await softDeleteWorkOrderFromAdmin(client, taskId)

  if (result.error) {
    throw new WorkOrderAdminMutationError(
      result.error.message ?? "No fue posible eliminar la orden de trabajo.",
      result.error.code === "CONFLICT" ? 409 : 500
    )
  }
}
