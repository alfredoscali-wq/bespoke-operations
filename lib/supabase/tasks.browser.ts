import { createClient } from "@/lib/supabase/client"
import {
  fetchOccupiedTaskCodesByPrefix,
  fetchLiveTaskByCompanyAndId,
  fetchTaskById,
  fetchTasks,
  fetchActiveWorkOrderListTasks,
  fetchArchivedWorkOrderListTasks,
  fetchCalendarWorkOrderListTasks,
  fetchDashboardWorkOrderListTasks,
  fetchOccupiedDispatchOrdersForPlanningConfirm,
  fetchOperarioTodayWorkOrderListTasks,
  fetchOperarioWebWorkOrderById,
  fetchPlanningWorkOrderListTasks,
  fetchProjectWorkOrderListTasks,
  insertTask,
  patchTask,
  softDeleteTask,
  type DashboardWorkOrderListData,
  type PlanningConfirmDispatchOccupancyScope,
  type SupabaseTasksClient,
} from "@/lib/supabase/tasks.queries"
import { toDateOnly } from "@/lib/availability/utils"
import type {
  ArchivedWorkOrderListPage,
  ArchivedWorkOrderListQuery,
} from "@/lib/tasks/archived-work-order-list"
import type { OperarioWebCrewRef } from "@/lib/tasks/task-list-scope"
import { applyVencidaSyncFromApi } from "@/lib/tasks/vencida-sync.client"
import type { Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  InsertTaskResult,
  TasksRepositoryResult,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"

export type { DashboardWorkOrderListData }

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

export async function listProjectWorkOrderTasks(
  companyId: string,
  projectId: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task[]>> {
  const result = await fetchProjectWorkOrderListTasks(
    client,
    companyId,
    projectId
  )

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

export async function listOccupiedDispatchOrdersForPlanningConfirm(
  companyId: string,
  scopes: PlanningConfirmDispatchOccupancyScope[],
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Record<string, number[]>>> {
  return fetchOccupiedDispatchOrdersForPlanningConfirm(
    client,
    companyId,
    scopes
  )
}

export async function listCalendarWorkOrderTasks(
  companyId: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task[]>> {
  const result = await fetchCalendarWorkOrderListTasks(client, companyId)

  if (result.error || !result.data) {
    return result
  }

  const syncedTasks = await applyVencidaSyncFromApi(result.data)

  return {
    data: syncedTasks,
    error: null,
  }
}

export async function listOperarioTodayWorkOrderTasks(
  companyId: string,
  crew: OperarioWebCrewRef,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task[]>> {
  const result = await fetchOperarioTodayWorkOrderListTasks(
    client,
    companyId,
    crew
  )

  if (result.error || !result.data) {
    return result
  }

  const syncedTasks = await applyVencidaSyncFromApi(result.data)

  return {
    data: syncedTasks,
    error: null,
  }
}

export async function getOperarioWebWorkOrderById(
  companyId: string,
  taskId: string,
  crew: OperarioWebCrewRef,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task>> {
  return fetchOperarioWebWorkOrderById(client, companyId, taskId, crew)
}

export async function listDashboardWorkOrderTasks(
  companyId: string,
  client: SupabaseTasksClient = createBrowserTasksClient(),
  today: string = toDateOnly()
): Promise<TasksRepositoryResult<DashboardWorkOrderListData>> {
  const result = await fetchDashboardWorkOrderListTasks(client, companyId, today)

  if (result.error || !result.data) {
    return result
  }

  const syncedTasks = await applyVencidaSyncFromApi(result.data.tasks)

  return {
    data: {
      ...result.data,
      tasks: syncedTasks,
    },
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

export async function getLiveTaskByCompanyAndId(
  companyId: string,
  id: string,
  client: SupabaseTasksClient = createBrowserTasksClient()
): Promise<TasksRepositoryResult<Task>> {
  return fetchLiveTaskByCompanyAndId(client, companyId, id)
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
