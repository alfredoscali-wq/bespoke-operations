import { createClient } from "@/lib/supabase/client"
import {
  fetchOccupiedTaskCodesByPrefix,
  fetchTaskById,
  fetchTasks,
  fetchActiveWorkOrderListTasks,
  fetchArchivedWorkOrderListTasks,
  fetchPlanningWorkOrderListTasks,
  insertTask,
  patchTask,
  softDeleteTask,
  type SupabaseTasksClient,
} from "@/lib/supabase/tasks.queries"
import type {
  ArchivedWorkOrderListPage,
  ArchivedWorkOrderListQuery,
} from "@/lib/tasks/archived-work-order-list"
import { applyVencidaSyncFromApi } from "@/lib/tasks/vencida-sync.client"
import type { Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  InsertTaskResult,
  TasksRepositoryResult,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"

export function createBrowserTasksClient(): SupabaseTasksClient {
  return createClient()
}

export async function listTasks(
  companyId: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task[]>> {
  const result = await fetchTasks(client, companyId)

  if (result.error || !result.data) {
    return result
  }

  const syncedTasks = await applyVencidaSyncFromApi(result.data)

  return {
    data: syncedTasks,
    error: null,
  }
}

export async function listActiveWorkOrderTasks(
  companyId: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task[]>> {
  const result = await fetchActiveWorkOrderListTasks(client, companyId)

  if (result.error || !result.data) {
    return result
  }

  const syncedTasks = await applyVencidaSyncFromApi(result.data)

  return {
    data: syncedTasks,
    error: null,
  }
}

export async function listPlanningWorkOrderTasks(
  companyId: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task[]>> {
  const result = await fetchPlanningWorkOrderListTasks(client, companyId)

  if (result.error || !result.data) {
    return result
  }

  const syncedTasks = await applyVencidaSyncFromApi(result.data)

  return {
    data: syncedTasks,
    error: null,
  }
}

export async function listArchivedWorkOrderTasks(
  companyId: string,
  input: ArchivedWorkOrderListQuery = {},
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<ArchivedWorkOrderListPage<Task>>> {
  return fetchArchivedWorkOrderListTasks(client, companyId, input)
}

export async function getTaskById(
  id: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task>> {
  return fetchTaskById(client, id)
}

export async function listOccupiedTaskCodesByPrefix(
  companyId: string,
  prefix: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<string[]>> {
  return fetchOccupiedTaskCodesByPrefix(client, companyId, prefix)
}

export async function createTask(
  payload: CreateTaskPayload,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<InsertTaskResult>> {
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
  return softDeleteTask(client, id)
}
