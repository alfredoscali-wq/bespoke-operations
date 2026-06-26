import { createClient } from "@/lib/supabase/client"
import {
  fetchOccupiedTaskCodesByPrefix,
  fetchTaskById,
  fetchTasks,
  insertTask,
  patchTask,
  softDeleteTask,
  type SupabaseTasksClient,
} from "@/lib/supabase/tasks.queries"
import { applyVencidaSyncFromApi } from "@/lib/tasks/vencida-sync.client"
import { logDeleteTrace } from "@/lib/supabase/delete-trace"
import type { Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  TasksRepositoryResult,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"

export function createBrowserTasksClient(): SupabaseTasksClient {
  return createClient()
}

export async function listTasks(
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task[]>> {
  const result = await fetchTasks(client)

  if (result.error || !result.data) {
    return result
  }

  const syncedTasks = await applyVencidaSyncFromApi(result.data)

  return {
    data: syncedTasks,
    error: null,
  }
}

export async function getTaskById(
  id: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task>> {
  return fetchTaskById(client, id)
}

export async function listOccupiedTaskCodesByPrefix(
  prefix: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<string[]>> {
  return fetchOccupiedTaskCodesByPrefix(client, prefix)
}

export async function createTask(
  payload: CreateTaskPayload,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task>> {
  return insertTask(client, payload)
}

export async function updateTask(
  id: string,
  payload: UpdateTaskPayload,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task>> {
  return patchTask(client, id, payload)
}

export async function deleteTask(
  id: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<void>> {
  logDeleteTrace("browser.deleteTask", { entity: "task", id })
  return softDeleteTask(client, id)
}
