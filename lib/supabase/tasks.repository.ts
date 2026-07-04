import "server-only"

import { createClient } from "@/lib/supabase/server"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  fetchTaskById,
  fetchTasks,
  insertTask,
  patchTask,
  softDeleteTask,
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
  companyId: string = BESPOKE_PRODUCTION_COMPANY_ID,
  client?: SupabaseTasksClient
): Promise<TasksRepositoryResult<Task[]>> {
  return fetchTasks(client ?? (await createServerTasksClient()), companyId)
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

export async function deleteTask(
  id: string,
  client?: SupabaseTasksClient
): Promise<TasksRepositoryResult<void>> {
  return softDeleteTask(client ?? (await createServerTasksClient()), id)
}

export { createBrowserTasksClient } from "@/lib/supabase/tasks.browser"
