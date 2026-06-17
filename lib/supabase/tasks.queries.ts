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
  formatTaskDeleteErrorMessage,
  logTaskSoftDeleteAttempt,
  logTaskSoftDeleteResult,
  serializeTaskDeleteError,
} from "@/lib/supabase/tasks-delete-diagnostics"
import { getSupabaseEnv } from "@/lib/supabase/env"

export type SupabaseTasksClient = SupabaseClient<Database>

export function mapSupabaseTaskError(error: {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}) {
  if (error.code === "23505") {
    return {
      code: "DUPLICATE_CODE" as const,
      message: "Ya existe una tarea con ese código.",
    }
  }

  const serialized = serializeTaskDeleteError(error)

  return {
    code: "UNKNOWN" as const,
    message: formatTaskDeleteErrorMessage(serialized),
  }
}

export async function fetchTasks(
  client: SupabaseTasksClient
): Promise<TasksRepositoryResult<Task[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
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
        message: "Tarea no encontrada.",
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
        message: "Tarea no encontrada.",
      },
    }
  }

  return { data: mapTaskRowToTask(data), error: null }
}

export async function softDeleteTask(
  client: SupabaseTasksClient,
  id: string
): Promise<TasksRepositoryResult<void>> {
  const payload = { deleted_at: new Date().toISOString() }

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
      console.error("[TASKS DELETE DIAG] request", {
        table: "tasks",
        url: buildTaskSoftDeleteRequestUrl(url, id),
        payload,
      })
    }

    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return { data: undefined, error: null }
}
