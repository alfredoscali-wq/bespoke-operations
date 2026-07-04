import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreatePayloadToInsert,
  mapTaskRowToTask,
  mapUpdatePayloadToUpdate,
} from "@/lib/supabase/tasks.mapper"
import type { Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  TasksRepositoryResult,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"
import {
  buildTaskSoftDeleteRequestUrl,
  logTaskSoftDeleteAttempt,
  logTaskSoftDeleteResult,
  serializeTaskDeleteError,
} from "@/lib/supabase/tasks-delete-diagnostics"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { logDeleteTrace } from "@/lib/supabase/delete-trace"
import { getSupabaseEnv } from "@/lib/supabase/env"
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks/status-groups"
import {
  canAdminModifyWorkOrder,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-admin-mutation"
import {
  canSoftDeleteWorkOrder,
  WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-deletion-policy"
import type { TaskStatus } from "@/lib/types/tasks"

export type SupabaseTasksClient = SupabaseClient<Database>

export function mapSupabaseTaskError(error: {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}) {
  if (error.code === "23514" || error.message.includes("TASK_STATUS_")) {
    return {
      code: "WORKFLOW" as const,
      message:
        error.message ||
        "Transición de estado no permitida para la orden de trabajo.",
    }
  }

  if (error.code === "23505") {
    const detail = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`
    if (
      detail.includes("tasks_execution_order_crew_date_unique")
    ) {
      return {
        code: "DUPLICATE_EXECUTION_ORDER" as const,
        message:
          "Ya existe otra OT con el mismo orden de ejecución para esa cuadrilla y fecha.",
      }
    }

    if (
      detail.includes("dispatch_order") ||
      detail.includes("tasks_dispatch_order_crew_date_unique")
    ) {
      return {
        code: "DUPLICATE_DISPATCH_ORDER" as const,
        message:
          "Ya existe otra OT con el mismo orden de despacho para esa cuadrilla y fecha.",
      }
    }

    return {
      code: "DUPLICATE_CODE" as const,
      message: "Ya existe una orden de trabajo con ese código.",
    }
  }

  const serialized = serializeTaskDeleteError(error)

  return {
    code: "UNKNOWN" as const,
    message: serialized.message,
  }
}

export async function fetchTasks(
  client: SupabaseTasksClient,
  companyId: string
): Promise<TasksRepositoryResult<Task[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskRowToTask),
    error: null,
  }
}

export async function fetchWorkOrdersByCustomerId(
  client: SupabaseTasksClient,
  customerId: string
): Promise<TasksRepositoryResult<Task[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .not("work_order_number", "is", null)
    .order("due_date", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskRowToTask),
    error: null,
  }
}

export async function fetchTaskById(
  client: SupabaseTasksClient,
  id: string
): Promise<TasksRepositoryResult<Task>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Orden de trabajo no encontrada.",
      },
    }
  }

  return { data: mapTaskRowToTask(data), error: null }
}

export async function insertTask(
  client: SupabaseTasksClient,
  payload: CreateTaskPayload
): Promise<TasksRepositoryResult<Task>> {
  const insertPayload = mapCreatePayloadToInsert(payload)

  const { data, error } = await client
    .from("tasks")
    .insert(insertPayload)
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return { data: mapTaskRowToTask(data), error: null }
}

export async function patchTask(
  client: SupabaseTasksClient,
  id: string,
  payload: UpdateTaskPayload
): Promise<TasksRepositoryResult<Task>> {
  const update = mapUpdatePayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const { data, error } = await client
    .from("tasks")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Orden de trabajo no encontrada.",
      },
    }
  }

  return { data: mapTaskRowToTask(data), error: null }
}

export async function softDeleteTask(
  client: SupabaseTasksClient,
  id: string
): Promise<TasksRepositoryResult<void>> {
  const { data: existingTask, error: fetchError } = await client
    .from("tasks")
    .select("status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (fetchError) {
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: TASK_DELETE_USER_MESSAGE,
      },
    }
  }

  if (!existingTask) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Orden de trabajo no encontrada.",
      },
    }
  }

  if (!canSoftDeleteWorkOrder(existingTask.status as TaskStatus)) {
    return {
      data: null,
      error: {
        code: "ACTIVE_TASK",
        message: WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
      },
    }
  }

  const payload = { deleted_at: new Date().toISOString() }

  logDeleteTrace("queries.softDeleteTask", { entity: "task", id })
  logTaskSoftDeleteAttempt({ taskId: id, payload })

  const { error, status, statusText } = await client
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .is("deleted_at", null)

  const serializedError = error ? serializeTaskDeleteError(error) : null

  console.info("[TASK DELETE]", {
    table: "tasks",
    taskId: id,
    message: "UPDATE executed",
    error: serializedError ?? null,
  })

  logTaskSoftDeleteResult({
    taskId: id,
    error: serializedError,
    status,
    statusText,
  })

  if (error) {
    const { url } = getSupabaseEnv()
    if (url) {
      console.error("[TASK DELETE]", {
        table: "tasks",
        url: buildTaskSoftDeleteRequestUrl(url, id),
        payload,
        error: serializedError,
      })
    }

    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: TASK_DELETE_USER_MESSAGE,
      },
    }
  }

  return { data: undefined, error: null }
}

export async function softDeleteWorkOrderFromAdmin(
  client: SupabaseTasksClient,
  id: string
): Promise<TasksRepositoryResult<void>> {
  const { data: existingTask, error: fetchError } = await client
    .from("tasks")
    .select("status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (fetchError) {
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: TASK_DELETE_USER_MESSAGE,
      },
    }
  }

  if (!existingTask) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Orden de trabajo no encontrada.",
      },
    }
  }

  if (!canAdminModifyWorkOrder(existingTask.status as TaskStatus)) {
    return {
      data: null,
      error: {
        code: "CONFLICT",
        message: WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
      },
    }
  }

  const payload = { deleted_at: new Date().toISOString() }

  logDeleteTrace("queries.softDeleteWorkOrderFromAdmin", { entity: "task", id })
  logTaskSoftDeleteAttempt({ taskId: id, payload })

  const { error, status, statusText } = await client
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .is("deleted_at", null)

  const serializedError = error ? serializeTaskDeleteError(error) : null

  logTaskSoftDeleteResult({
    taskId: id,
    error: serializedError,
    status,
    statusText,
  })

  if (error) {
    const { url } = getSupabaseEnv()
    if (url) {
      console.error("[TASK DELETE]", {
        table: "tasks",
        url: buildTaskSoftDeleteRequestUrl(url, id),
        payload,
        error: serializedError,
      })
    }

    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: TASK_DELETE_USER_MESSAGE,
      },
    }
  }

  return { data: undefined, error: null }
}

export async function fetchOccupiedTaskCodesByPrefix(
  client: SupabaseTasksClient,
  companyId: string,
  prefix: string
): Promise<TasksRepositoryResult<string[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("code")
    .eq("company_id", companyId)
    .like("code", `${prefix}%`)

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: (data ?? []).map((row) => row.code),
    error: null,
  }
}

export async function findActiveTasksForProject(
  client: SupabaseTasksClient,
  projectId: string,
  projectCode?: string
): Promise<
  TasksRepositoryResult<{
    tasks: { id: string; status: TaskStatus }[]
  }>
> {
  const { data: tasksByProjectId, error: fetchByIdError } = await client
    .from("tasks")
    .select("id, status")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .in("status", ACTIVE_TASK_STATUSES)

  if (fetchByIdError) {
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: TASK_DELETE_USER_MESSAGE,
      },
    }
  }

  const activeTasks = [...(tasksByProjectId ?? [])]

  if (projectCode) {
    const { data: orphanTasks, error: orphanFetchError } = await client
      .from("tasks")
      .select("id, status")
      .eq("project_code", projectCode)
      .is("project_id", null)
      .is("deleted_at", null)
      .in("status", ACTIVE_TASK_STATUSES)

    if (orphanFetchError) {
      return {
        data: null,
        error: {
          code: "UNKNOWN",
          message: TASK_DELETE_USER_MESSAGE,
        },
      }
    }

    const seenIds = new Set(activeTasks.map((task) => task.id))
    for (const task of orphanTasks ?? []) {
      if (!seenIds.has(task.id)) {
        activeTasks.push(task)
      }
    }
  }

  return {
    data: { tasks: activeTasks },
    error: null,
  }
}
