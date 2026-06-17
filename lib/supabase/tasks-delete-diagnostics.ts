import type { SupabaseTasksClient } from "@/lib/supabase/tasks.queries"

const DIAG_PREFIX = "[TASKS DELETE DIAG]"

export type TaskDeleteSupabaseError = {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export function serializeTaskDeleteError(error: unknown): TaskDeleteSupabaseError {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      message:
        typeof record.message === "string"
          ? record.message
          : "Error desconocido al eliminar la tarea.",
      details:
        typeof record.details === "string" || record.details === null
          ? (record.details as string | null)
          : undefined,
      hint:
        typeof record.hint === "string" || record.hint === null
          ? (record.hint as string | null)
          : undefined,
    }
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: "Error desconocido al eliminar la tarea." }
}

export function logTaskSoftDeleteAttempt(input: {
  taskId: string
  payload: { deleted_at: string }
}) {
  console.info(`${DIAG_PREFIX} softDeleteTask attempt`, input)
}

export function logTaskSoftDeleteResult(input: {
  taskId: string
  error: TaskDeleteSupabaseError | null
  status?: number
  statusText?: string
}) {
  if (input.error) {
    console.error(`${DIAG_PREFIX} softDeleteTask failed`, {
      taskId: input.taskId,
      table: "tasks",
      operation: "UPDATE deleted_at",
      code: input.error.code,
      message: input.error.message,
      details: input.error.details,
      hint: input.error.hint,
      httpStatus: input.status,
      httpStatusText: input.statusText,
    })
    return
  }

  console.info(`${DIAG_PREFIX} softDeleteTask success`, { taskId: input.taskId })
}

export function formatTaskDeleteErrorMessage(
  error: TaskDeleteSupabaseError
): string {
  return error.message
}

export function buildTaskSoftDeleteRequestUrl(
  supabaseUrl: string,
  taskId: string
): string {
  return `${supabaseUrl}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&deleted_at=is.null`
}
