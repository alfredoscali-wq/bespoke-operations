import { createClient } from "@/lib/supabase/server"
import {
  fetchTaskById,
  fetchTasks,
  insertTask,
  patchTask,
  type SupabaseTasksClient,
} from "@/lib/supabase/tasks.queries"
import type { Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  TasksRepositoryResult,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"

async function createServerTasksClient(): Promise<SupabaseTasksClient> {
  return createClient()
}

export async function listTasks(
  client?: SupabaseTasksClient
): Promise<TasksRepositoryResult<Task[]>> {
  return fetchTasks(client ?? (await createServerTasksClient()))
}

export async function getTaskById(
  id: string,
  client?: SupabaseTasksClient
): Promise<TasksRepositoryResult<Task>> {
  return fetchTaskById(client ?? (await createServerTasksClient()), id)
}

export async function createTask(
  payload: CreateTaskPayload,
  client?: SupabaseTasksClient
): Promise<TasksRepositoryResult<Task>> {
  return insertTask(client ?? (await createServerTasksClient()), payload)
}

export async function updateTask(
  id: string,
  payload: UpdateTaskPayload,
  client?: SupabaseTasksClient
): Promise<TasksRepositoryResult<Task>> {
  return patchTask(
    client ?? (await createServerTasksClient()),
    id,
    payload
  )
}

export { createBrowserTasksClient } from "@/lib/supabase/tasks.browser"
