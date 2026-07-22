import "server-only"

import {
  buildCompactExecutionOrderUpdates,
} from "@/lib/planificacion/planning-execution-order"
import {
  fetchNextExecutionOrderForCrewDate,
  fetchTaskById,
  fetchTaskCompanyId,
  fetchTasksForOperationalOrderScope,
  patchTask,
  persistExecutionOrderUpdates,
  softDeleteWorkOrderFromAdmin,
  type SupabaseTasksClient,
} from "@/lib/supabase/tasks.queries"
import {
  buildAdminWorkOrderPatchPayload,
  resolveAdminWorkOrderExecutionOrderDestination,
  shouldRecalculateAdminWorkOrderExecutionOrder,
} from "@/lib/tasks/work-order-admin-execution-order"
import {
  canAdminModifyWorkOrderTask,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
  WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-admin-mutation"
import {
  canAdminSoftDeleteWorkOrder,
  WORK_ORDER_PLANNING_RETURN_DELETE_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-deletion-policy"
import { hasActivePlanningReturn } from "@/lib/tasks/planning-return"
import { isArchiveWorkOrderStatus } from "@/lib/tasks/task-list-scope"
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

function assertAdminWorkOrderMutable(task: Task): void {
  if (!canAdminModifyWorkOrderTask(task)) {
    throw new WorkOrderAdminMutationError(
      hasActivePlanningReturn(task)
        ? WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_MESSAGE
        : WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
      409
    )
  }
}

function assertAdminWorkOrderSoftDeletable(
  task: Task,
  sessionUser: SessionUser
): void {
  if (!canAdminSoftDeleteWorkOrder(task)) {
    throw new WorkOrderAdminMutationError(
      hasActivePlanningReturn(task)
        ? WORK_ORDER_PLANNING_RETURN_DELETE_BLOCKED_MESSAGE
        : WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
      409
    )
  }

  if (
    isArchiveWorkOrderStatus(task.status) &&
    sessionUser.systemRole !== "administrador"
  ) {
    throw new WorkOrderAdminMutationError(
      "Solo un administrador del sistema puede eliminar definitivamente una orden del Archivo OT.",
      403
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

async function compactProgramadaScopeAfterRemoval(
  client: SupabaseTasksClient,
  input: {
    companyId: string
    dueDate: string
    crewId: string
    excludeTaskId?: string
  }
): Promise<void> {
  const scopeResult = await fetchTasksForOperationalOrderScope(client, {
    companyId: input.companyId,
    dueDate: input.dueDate,
    crewId: input.crewId,
  })

  if (scopeResult.error || !scopeResult.data) {
    throw new WorkOrderAdminMutationError(
      scopeResult.error?.message ??
        "No fue posible normalizar el orden de ejecución de la cuadrilla.",
      500
    )
  }

  const compactUpdates = buildCompactExecutionOrderUpdates({
    tasks: scopeResult.data,
    dueDate: input.dueDate,
    crewId: input.crewId,
    excludeTaskIds: input.excludeTaskId ? [input.excludeTaskId] : [],
  })

  if (compactUpdates.length === 0) {
    return
  }

  const persistResult = await persistExecutionOrderUpdates(
    client,
    compactUpdates,
    scopeResult.data
  )

  if (persistResult.error) {
    throw new WorkOrderAdminMutationError(
      persistResult.error.message ??
        "No fue posible normalizar el orden de ejecución de la cuadrilla.",
      persistResult.error.code === "DUPLICATE_EXECUTION_ORDER" ? 409 : 500
    )
  }
}

export async function updateWorkOrderFromAdmin(
  client: SupabaseTasksClient,
  taskId: string,
  payload: UpdateTaskPayload,
  sessionUser: SessionUser
): Promise<Task> {
  assertWritableAdminRole(sessionUser)
  const existing = await fetchTaskForAdminMutation(client, taskId)
  assertAdminWorkOrderMutable(existing)

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

    const companyId = companyResult.data
    const originCrewId = existing.crewId?.trim() || null
    const originDueDate = existing.dueDate?.trim() || null

    if (
      existing.status === "programada" &&
      originCrewId &&
      originDueDate &&
      (originCrewId !== destination.crewId || originDueDate !== destination.dueDate)
    ) {
      await compactProgramadaScopeAfterRemoval(client, {
        companyId,
        dueDate: originDueDate,
        crewId: originCrewId,
        excludeTaskId: taskId,
      })
    }

    const nextOrderResult = await fetchNextExecutionOrderForCrewDate(client, {
      companyId,
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
  assertAdminWorkOrderSoftDeletable(existing, sessionUser)

  const originCrewId = existing.crewId?.trim() || null
  const originDueDate = existing.dueDate?.trim() || null
  const shouldCompactOrigin =
    existing.status === "programada" && Boolean(originCrewId && originDueDate)

  const companyResult = await fetchTaskCompanyId(client, taskId)
  const companyId = companyResult.data

  const result = await softDeleteWorkOrderFromAdmin(client, taskId)

  if (result.error) {
    throw new WorkOrderAdminMutationError(
      result.error.message ?? "No fue posible eliminar la orden de trabajo.",
      result.error.code === "CONFLICT" ? 409 : 500
    )
  }

  if (shouldCompactOrigin && companyId && originCrewId && originDueDate) {
    await compactProgramadaScopeAfterRemoval(client, {
      companyId,
      dueDate: originDueDate,
      crewId: originCrewId,
    })
  }
}
