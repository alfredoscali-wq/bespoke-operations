import type { Task } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import { WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE } from "@/lib/tasks/work-order-admin-mutation"

type AdminTaskApiErrorBody = {
  success?: boolean
  message?: string
}

export class AdminTaskApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AdminTaskApiError"
    this.status = status
  }
}

async function readAdminTaskApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as AdminTaskApiErrorBody
    return body.message?.trim() || WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE
  } catch {
    return WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE
  }
}

export async function updateWorkOrderThroughAdminApi(
  taskId: string,
  payload: UpdateTaskPayload
): Promise<Task> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new AdminTaskApiError(
      await readAdminTaskApiError(response),
      response.status
    )
  }

  const body = (await response.json()) as { task?: Task }
  if (!body.task) {
    throw new AdminTaskApiError(
      "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
      500
    )
  }

  return body.task
}

export async function deleteWorkOrderThroughAdminApi(taskId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new AdminTaskApiError(
      await readAdminTaskApiError(response),
      response.status
    )
  }
}
