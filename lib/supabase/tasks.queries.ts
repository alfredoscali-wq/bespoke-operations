import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"
import type { TaskRow } from "@/lib/supabase/database.aliases"
import {
  mapCreatePayloadToInsert,
  mapTaskRowToTask,
  mapUpdatePayloadToUpdate,
} from "@/lib/supabase/tasks.mapper"
import { fetchTaskDailyAllocationsByCompany } from "@/lib/supabase/task-daily-allocations.queries"
import type { Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  TasksRepositoryResult,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"
import { TASK_DELETE_USER_MESSAGE, logOperationError } from "@/lib/operations/user-messages"
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks/status-groups"
import { validateObraTaskInsertIntegrity } from "@/lib/projects/obra-task-insert-integrity"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  canAdminModifyWorkOrder,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-admin-mutation"
import {
  canAdminSoftDeleteWorkOrder,
  canSoftDeleteWorkOrder,
  WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-deletion-policy"
import type { TaskStatus } from "@/lib/types/tasks"
import {
  buildExecutionOrderPersistPlan,
  type ExecutionOrderUpdate,
} from "@/lib/planificacion/planning-execution-order"
import { resolveNextPlanningQueuePosition } from "@/lib/planificacion/planning-dynamic"
import {
  stripClientExecutionOrder,
  TASK_EXECUTION_ORDER_CONFLICT_CODE,
  TASK_EXECUTION_ORDER_CONFLICT_MESSAGE,
} from "@/lib/tasks/execution-order-create"

export type SupabaseTasksClient = SupabaseClient<Database>

async function attachDailyAllocations(
  client: SupabaseTasksClient,
  companyId: string,
  tasks: Task[]
): Promise<Task[]> {
  if (tasks.length === 0) {
    return tasks
  }

  try {
    const byTask = await fetchTaskDailyAllocationsByCompany(
      client as unknown as SupabaseClient,
      companyId
    )
    if (byTask.size === 0) {
      return tasks
    }

    return tasks.map((task) => {
      const dailyAllocations = byTask.get(task.id)
      if (!dailyAllocations || dailyAllocations.length === 0) {
        return task
      }
      return { ...task, dailyAllocations }
    })
  } catch {
    // Soft-fail: capacity falls back to even split without allocations.
    return tasks
  }
}

export function mapSupabaseTaskError(error: {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}) {
  const blob = `${error.code ?? ""} ${error.message} ${error.details ?? ""} ${error.hint ?? ""}`
  if (blob.includes(TASK_EXECUTION_ORDER_CONFLICT_CODE)) {
    return {
      code: TASK_EXECUTION_ORDER_CONFLICT_CODE,
      message: TASK_EXECUTION_ORDER_CONFLICT_MESSAGE,
    }
  }

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

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

/** Create path: unexpected unique collisions become a retryable structured conflict. */
export function mapInsertTaskError(error: {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}) {
  const mapped = mapSupabaseTaskError(error)
  if (mapped.code === "DUPLICATE_EXECUTION_ORDER") {
    return {
      code: TASK_EXECUTION_ORDER_CONFLICT_CODE,
      message: TASK_EXECUTION_ORDER_CONFLICT_MESSAGE,
    }
  }
  return mapped
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

  const tasks = (data ?? []).map(mapTaskRowToTask)
  return {
    data: await attachDailyAllocations(client, companyId, tasks),
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
  let insertPayload = payload
  const projectId = payload.projectId?.trim() || null

  if (projectId) {
    const companyId = payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID
    const crewId = payload.crewId?.trim() || null

    const { data: projectRow, error: projectError } = await client
      .from("projects")
      .select("id, company_id, status, deleted_at")
      .eq("id", projectId)
      .maybeSingle()

    if (projectError) {
      return { data: null, error: mapSupabaseTaskError(projectError) }
    }

    let crew:
      | { id: string; companyId: string; deletedAt: string | null }
      | null = null

    if (crewId) {
      const { data: crewRow, error: crewError } = await client
        .from("crews")
        .select("id, company_id, deleted_at")
        .eq("id", crewId)
        .maybeSingle()

      if (crewError) {
        return { data: null, error: mapSupabaseTaskError(crewError) }
      }

      if (crewRow) {
        crew = {
          id: crewRow.id,
          companyId: crewRow.company_id,
          deletedAt: crewRow.deleted_at,
        }
      }
    }

    const integrity = validateObraTaskInsertIntegrity({
      task: {
        companyId,
        projectId,
        crewId,
        status: payload.status ?? "programada",
      },
      project: projectRow
        ? {
            id: projectRow.id,
            companyId: projectRow.company_id,
            status: projectRow.status,
            deletedAt: projectRow.deleted_at,
          }
        : null,
      crew,
    })

    if (!integrity.ok) {
      return {
        data: null,
        error: {
          code: "WORKFLOW",
          message: integrity.message,
        },
      }
    }

    insertPayload = {
      ...payload,
      status: integrity.status,
    }
  }

  const mapped = {
    ...mapCreatePayloadToInsert(stripClientExecutionOrder(insertPayload)),
    execution_order: null,
    dispatch_order: null,
  }

  const { data, error } = await client.rpc("create_task_with_execution_order", {
    p_payload: mapped as unknown as Json,
  })

  if (error) {
    const mappedError = mapInsertTaskError(error)
    logOperationError("TASK CREATE", {
      code: mappedError.code,
      companyId: insertPayload.companyId ?? null,
      crewId: insertPayload.crewId ?? null,
      dueDate: insertPayload.dueDate ?? null,
      executionOrder: null,
    })
    return { data: null, error: mappedError }
  }

  if (!data || typeof data !== "object" || Array.isArray(data) || !("id" in data)) {
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: "No fue posible crear la orden de trabajo. Intente nuevamente.",
      },
    }
  }

  const created = mapTaskRowToTask(data as TaskRow)

  return { data: created, error: null }
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
    .select("status, project_id, progress, completed_at, closed_at, task_metadata")
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

  const softDeleteCandidate = {
    status: existingTask.status as TaskStatus,
    projectId: existingTask.project_id ?? undefined,
    progress: existingTask.progress ?? 0,
    completedAt: existingTask.completed_at,
    closedAt: existingTask.closed_at,
    taskMetadata:
      existingTask.task_metadata &&
      typeof existingTask.task_metadata === "object" &&
      !Array.isArray(existingTask.task_metadata)
        ? (existingTask.task_metadata as Record<string, unknown>)
        : {},
  }

  if (!canSoftDeleteWorkOrder(softDeleteCandidate)) {
    return {
      data: null,
      error: {
        code: "ACTIVE_TASK",
        message: WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
      },
    }
  }

  const { error } = await client
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
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
    .select("status, project_id, progress, completed_at, closed_at, task_metadata")
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

  const softDeleteCandidate = {
    status: existingTask.status as TaskStatus,
    projectId: existingTask.project_id ?? undefined,
    progress: existingTask.progress ?? 0,
    completedAt: existingTask.completed_at,
    closedAt: existingTask.closed_at,
    taskMetadata:
      existingTask.task_metadata &&
      typeof existingTask.task_metadata === "object" &&
      !Array.isArray(existingTask.task_metadata)
        ? (existingTask.task_metadata as Record<string, unknown>)
        : {},
  }

  if (!canAdminSoftDeleteWorkOrder(softDeleteCandidate)) {
    return {
      data: null,
      error: {
        code: "CONFLICT",
        message: WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
      },
    }
  }

  const { error } = await client
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
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
    data: {
      tasks: activeTasks.map((task) => ({
        id: task.id,
        status: task.status as TaskStatus,
      })),
    },
    error: null,
  }
}

export async function fetchTaskCompanyId(
  client: SupabaseTasksClient,
  taskId: string
): Promise<TasksRepositoryResult<string>> {
  const { data, error } = await client
    .from("tasks")
    .select("company_id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  if (!data?.company_id) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Orden de trabajo no encontrada.",
      },
    }
  }

  return { data: data.company_id, error: null }
}

export async function fetchTasksForOperationalOrderScope(
  client: SupabaseTasksClient,
  input: {
    companyId: string
    dueDate: string
    crewId: string
  }
): Promise<TasksRepositoryResult<Task[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("due_date", input.dueDate)
    .eq("crew_id", input.crewId)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskRowToTask),
    error: null,
  }
}

/** First available execution_order for (company, due_date, crew_id), respecting frozen slots. */
export async function fetchNextExecutionOrderForCrewDate(
  client: SupabaseTasksClient,
  input: {
    companyId: string
    dueDate: string
    crewId: string
    excludeTaskId: string
  }
): Promise<TasksRepositoryResult<number>> {
  const scopeResult = await fetchTasksForOperationalOrderScope(client, {
    companyId: input.companyId,
    dueDate: input.dueDate,
    crewId: input.crewId,
  })

  if (scopeResult.error || !scopeResult.data) {
    return {
      data: null,
      error:
        scopeResult.error ??
        ({
          code: "UNKNOWN" as const,
          message:
            "No fue posible calcular el orden de ejecución para la orden de trabajo.",
        }),
    }
  }

  return {
    data: resolveNextPlanningQueuePosition({
      tasks: scopeResult.data,
      dueDate: input.dueDate,
      crewId: input.crewId,
      excludeTaskId: input.excludeTaskId,
    }),
    error: null,
  }
}

export async function persistExecutionOrderUpdates(
  client: SupabaseTasksClient,
  updates: ExecutionOrderUpdate[],
  tasks: Task[]
): Promise<TasksRepositoryResult<void>> {
  const plan = buildExecutionOrderPersistPlan(updates, tasks, [])

  for (const phase of plan.phases) {
    for (const update of phase) {
      const result = await patchTask(client, update.taskId, {
        executionOrder: update.executionOrder,
      })

      if (result.error) {
        return {
          data: null,
          error: result.error,
        }
      }
    }
  }

  return { data: undefined, error: null }
}
