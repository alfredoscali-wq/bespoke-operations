import "server-only"

import {
  fetchNextExecutionOrderForCrewDate,
  fetchTaskById,
  fetchTaskCompanyId,
  patchTask,
  softDeleteWorkOrderFromAdmin,
  type SupabaseTasksClient,
} from "@/lib/supabase/tasks.queries"
import {
  buildAdminWorkOrderPatchPayload,
  resolveAdminWorkOrderExecutionOrderDestination,
  shouldRecalculateAdminWorkOrderExecutionOrder,
} from "@/lib/tasks/work-order-admin-execution-order"
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

  let authoritativeExecutionOrder: number | undefined

  if (shouldRecalculateAdminWorkOrderExecutionOrder(existing, fieldsOnly)) {
    const destination = resolveAdminWorkOrderExecutionOrderDestination(
      existing,
      fieldsOnly
    )

    if (!destination) {
      throw new WorkOrderAdminMutationError(
        "No fue posible determinar la cuadrilla o fecha destino para la orden de trabajo.",
        400
      )
    }

    const companyResult = await fetchTaskCompanyId(client, taskId)
    if (companyResult.error || !companyResult.data) {
      throw new WorkOrderAdminMutationError(
        companyResult.error?.message ?? "Orden de trabajo no encontrada.",
        404
      )
    }

    const nextOrderResult = await fetchNextExecutionOrderForCrewDate(client, {
      companyId: companyResult.data,
      dueDate: destination.dueDate,
      crewId: destination.crewId,
      excludeTaskId: taskId,
    })

    if (nextOrderResult.error || nextOrderResult.data == null) {
      throw new WorkOrderAdminMutationError(
        nextOrderResult.error?.message ??
          "No fue posible calcular el orden de ejecución para la orden de trabajo.",
        500
      )
    }

    authoritativeExecutionOrder = nextOrderResult.data
  }

  const patchPayload = buildAdminWorkOrderPatchPayload(
    fieldsOnly,
    authoritativeExecutionOrder
  )

  const result = await patchTask(client, taskId, patchPayload)

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
