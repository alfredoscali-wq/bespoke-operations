import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"
import type { TaskRow } from "@/lib/supabase/database.aliases"
import {
  mapCreatePayloadToInsert,
  mapTaskRowToTask,
  mapUpdatePayloadToUpdate,
} from "@/lib/supabase/tasks.mapper"
import { fetchTaskDailyAllocationsByCompany } from "@/lib/supabase/task-daily-allocations.queries"
import type { Task, TaskPriority, TaskStatus } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  InsertTaskResult,
  TasksRepositoryErrorCode,
  TasksRepositoryResult,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"
import { TASK_DELETE_USER_MESSAGE, logOperationError } from "@/lib/operations/user-messages"
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks/status-groups"
import {
  ARCHIVE_WORK_ORDER_LIST_STATUS,
  ACTIVE_WORK_ORDER_LIST_STATUSES,
  CALENDAR_WORK_ORDER_LIST_STATUSES,
  DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES,
  DASHBOARD_FINALIZADA_COUNT_STATUS,
  DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES,
  DASHBOARD_PROJECT_METRIC_COMPLETED_STATUSES,
  DASHBOARD_PROJECT_METRIC_PAGE_SIZE,
  DASHBOARD_RECENT_ACTIVITY_LIMIT,
  DASHBOARD_RECENT_ACTIVITY_WORK_ORDER_LIST_STATUSES,
  OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES,
  PLANNING_WORK_ORDER_LIST_STATUSES,
  PROJECT_WORK_ORDER_LIST_PAGE_SIZE,
  type OperarioWebCrewRef,
  hasOperarioWebCrew,
} from "@/lib/tasks/task-list-scope"
import {
  ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE,
  buildArchivedWorkOrderSearchOrFilter,
  isArchivedWorkOrderPrioritySort,
  resolveArchivedWorkOrderListRange,
  resolveArchivedWorkOrderListSortColumn,
  resolveArchivedWorkOrderPriorityBucketSlices,
  resolveArchivedWorkOrderPrioritySequence,
  resolveArchivedWorkOrderTypeFilter,
  shouldShortCircuitArchivedWorkOrderObraFilter,
  type ArchivedWorkOrderListPage,
  type ArchivedWorkOrderListQuery,
} from "@/lib/tasks/archived-work-order-list"
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
import {
  buildCreateWorkOrderIdempotentRpcPayload,
  parseCreateWorkOrderIdempotentResponse,
  toCreateWorkOrderIdempotentResult,
  WORK_ORDER_IDEMPOTENCY_KEY_INVALID_CODE,
  WORK_ORDER_IDEMPOTENCY_KEY_INVALID_MESSAGE,
  WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_CODE,
  WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_MESSAGE,
  WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE,
  WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_MESSAGE,
} from "@/lib/tasks/work-order-idempotency"

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
}): { code: TasksRepositoryErrorCode; message: string } {
  const blob = `${error.code ?? ""} ${error.message} ${error.details ?? ""} ${error.hint ?? ""}`
  if (blob.includes(TASK_EXECUTION_ORDER_CONFLICT_CODE)) {
    return {
      code: TASK_EXECUTION_ORDER_CONFLICT_CODE,
      message: TASK_EXECUTION_ORDER_CONFLICT_MESSAGE,
    }
  }

  if (blob.includes(WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_CODE)) {
    return {
      code: WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_CODE,
      message: WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_MESSAGE,
    }
  }

  if (blob.includes(WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE)) {
    return {
      code: WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE,
      message: WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_MESSAGE,
    }
  }

  if (blob.includes(WORK_ORDER_IDEMPOTENCY_KEY_INVALID_CODE)) {
    return {
      code: WORK_ORDER_IDEMPOTENCY_KEY_INVALID_CODE,
      message: WORK_ORDER_IDEMPOTENCY_KEY_INVALID_MESSAGE,
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

  if (error.message.includes("Stock insuficiente")) {
    return {
      code: "VALIDATION" as const,
      message: error.message,
    }
  }

  if (error.message.includes("MATERIAL_CONSUMPTION_REQUIRED")) {
    return {
      code: "VALIDATION" as const,
      message:
        "Debe confirmar los materiales utilizados antes de finalizar la OT.",
    }
  }

  if (error.code === "23505") {
    const detail = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`
    if (detail.includes("tasks_company_idempotency_key_unique")) {
      return {
        code: "CONFLICT" as const,
        message:
          "No pudimos completar la creación. Intentá nuevamente.",
      }
    }

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
}): { code: TasksRepositoryErrorCode; message: string } {
  const mapped = mapSupabaseTaskError(error)
  if (mapped.code === "DUPLICATE_EXECUTION_ORDER") {
    return {
      code: TASK_EXECUTION_ORDER_CONFLICT_CODE,
      message: TASK_EXECUTION_ORDER_CONFLICT_MESSAGE,
    }
  }
  return mapped
}

async function mapFetchedTaskRows(
  client: SupabaseTasksClient,
  companyId: string,
  data: unknown
): Promise<Task[]> {
  const tasks = ((data ?? []) as TaskRow[]).map(mapTaskRowToTask)
  return attachDailyAllocations(client, companyId, tasks)
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
    data: await mapFetchedTaskRows(client, companyId, data),
    error: null,
  }
}

/**
 * Órdenes de Trabajo (listado activo). Narrower than fetchTasks so PostgREST
 * max_rows=1000 cannot drop recent operational OTs behind historical finalizadas.
 * Do not reuse for Archivo, Planificación, Obras, Mobile, or Dashboard.
 */
export async function fetchActiveWorkOrderListTasks(
  client: SupabaseTasksClient,
  companyId: string
): Promise<TasksRepositoryResult<Task[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .is("project_id", null)
    .in("status", [...ACTIVE_WORK_ORDER_LIST_STATUSES])
    .order("due_date", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: await mapFetchedTaskRows(client, companyId, data),
    error: null,
  }
}

/**
 * Planificación operativa (`/operations/planificacion`). Narrower than
 * fetchTasks so PostgREST max_rows=1000 cannot drop today's OTs behind
 * historical finalizadas. Includes Obras (project_id set) for the Obras lane
 * and pendiente-cierre sheet. Do not reuse for /tareas, Archivo, Mobile, or Dashboard.
 */
export async function fetchPlanningWorkOrderListTasks(
  client: SupabaseTasksClient,
  companyId: string
): Promise<TasksRepositoryResult<Task[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in("status", [...PLANNING_WORK_ORDER_LIST_STATUSES])
    .order("due_date", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: await mapFetchedTaskRows(client, companyId, data),
    error: null,
  }
}

export type PlanningConfirmDispatchOccupancyScope = {
  dueDate: string
  crewId: string
}

/**
 * Occupied dispatch_order slots for Planificar confirm.
 * Matches tasks_dispatch_order_crew_date_unique (no status filter).
 * Scoped by company + due_date + crew_id. Do not call fetchTasks.
 */
export async function fetchOccupiedDispatchOrdersForPlanningConfirm(
  client: SupabaseTasksClient,
  companyId: string,
  scopes: PlanningConfirmDispatchOccupancyScope[]
): Promise<TasksRepositoryResult<Record<string, number[]>>> {
  const uniqueScopes = new Map<string, PlanningConfirmDispatchOccupancyScope>()

  for (const scope of scopes) {
    const dueDate = scope.dueDate.trim()
    const crewId = scope.crewId.trim()
    if (!dueDate || !crewId) {
      continue
    }

    uniqueScopes.set(`${dueDate}::${crewId}`, { dueDate, crewId })
  }

  const occupancy: Record<string, number[]> = {}

  if (uniqueScopes.size === 0) {
    return { data: occupancy, error: null }
  }

  const scopesByDate = new Map<string, string[]>()
  for (const scope of uniqueScopes.values()) {
    const crewIds = scopesByDate.get(scope.dueDate) ?? []
    crewIds.push(scope.crewId)
    scopesByDate.set(scope.dueDate, crewIds)
  }

  for (const [dueDate, crewIds] of scopesByDate) {
    const { data, error } = await client
      .from("tasks")
      .select("due_date, crew_id, dispatch_order")
      .eq("company_id", companyId)
      .eq("due_date", dueDate)
      .in("crew_id", crewIds)
      .is("deleted_at", null)
      .not("dispatch_order", "is", null)

    if (error) {
      return { data: null, error: mapSupabaseTaskError(error) }
    }

    for (const row of data ?? []) {
      const crewId = row.crew_id?.trim() ?? ""
      const order = row.dispatch_order
      if (!crewId || order == null || order <= 0) {
        continue
      }

      const key = `${dueDate}::${crewId}`
      const current = occupancy[key] ?? []
      current.push(Math.floor(order))
      occupancy[key] = current
    }
  }

  return { data: occupancy, error: null }
}

/**
 * Calendario operativo (`/operations/calendar`). Narrower than fetchTasks so
 * PostgREST max_rows=1000 cannot drop today's OTs behind historical
 * finalizadas. Includes Obras (project_id set) for the Obras view, projectId
 * filter, and Todos/Operaciones grid. Do not reuse for /tareas, Archivo,
 * Planificación, Mobile, or Dashboard.
 */
export async function fetchCalendarWorkOrderListTasks(
  client: SupabaseTasksClient,
  companyId: string
): Promise<TasksRepositoryResult<Task[]>> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in("status", [...CALENDAR_WORK_ORDER_LIST_STATUSES])
    .order("due_date", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: await mapFetchedTaskRows(client, companyId, data),
    error: null,
  }
}

/**
 * Obra → Órdenes de trabajo (`ProjectTasksTab`). Scoped by company + project
 * so PostgREST max_rows=1000 cannot hide a project's OT behind the company-wide
 * due_date window of the unscoped task list. Pages within the project.
 * Includes borrador. Do not reuse for /tareas, Archivo, Planificación,
 * Calendario, Mobile, or Dashboard.
 */
export async function fetchProjectWorkOrderListTasks(
  client: SupabaseTasksClient,
  companyId: string,
  projectId: string
): Promise<TasksRepositoryResult<Task[]>> {
  const rows: TaskRow[] = []
  let from = 0

  for (;;) {
    const page = await client
      .from("tasks")
      .select("*")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .order("code", { ascending: true })
      .range(from, from + PROJECT_WORK_ORDER_LIST_PAGE_SIZE - 1)

    if (page.error) {
      return { data: null, error: mapSupabaseTaskError(page.error) }
    }

    const pageRows = (page.data ?? []) as TaskRow[]
    rows.push(...pageRows)

    if (pageRows.length < PROJECT_WORK_ORDER_LIST_PAGE_SIZE) {
      break
    }

    from += PROJECT_WORK_ORDER_LIST_PAGE_SIZE
  }

  return {
    data: await mapFetchedTaskRows(client, companyId, rows),
    error: null,
  }
}

export type DashboardWorkOrderListData = {
  tasks: Task[]
  finalizadaCount: number
  projectMetricTasks: Task[]
}

/**
 * Dashboard operativo (`/`). Specialized queries so PostgREST max_rows=1000
 * cannot hide today's OTs behind historical finalizadas, without changing
 * KPI semantics:
 * 1) live operational statuses including borrador (Pendientes / cycle KPIs)
 * 2) finalizada/cerrada with due_date = today (KPI "Finalizadas hoy")
 * 3) COUNT of status = finalizada with no date filter (KPI "Finalizadas")
 * 4) finalizada/cancelada ORDER BY created_at DESC LIMIT 10 (actividad reciente)
 * 5) paginated finalizada/cerrada with project_id (progreso de Obras)
 *
 * `today` must be the same YYYY-MM-DD string Dashboard builders use
 * (`toDateOnly()` = UTC date-only). Do not reuse for /tareas, Archivo,
 * Planificación, Calendario, Mobile, or Obras.
 */
export async function fetchDashboardWorkOrderListTasks(
  client: SupabaseTasksClient,
  companyId: string,
  today: string
): Promise<TasksRepositoryResult<DashboardWorkOrderListData>> {
  const [operational, completedToday, finalizadaCountResult, recentActivity] =
    await Promise.all([
      client
        .from("tasks")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("status", [...DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES])
        .order("due_date", { ascending: true }),
      client
        .from("tasks")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("status", [...DASHBOARD_COMPLETED_TODAY_WORK_ORDER_LIST_STATUSES])
        .eq("due_date", today)
        .order("due_date", { ascending: true }),
      client
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .eq("status", DASHBOARD_FINALIZADA_COUNT_STATUS),
      client
        .from("tasks")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("status", [...DASHBOARD_RECENT_ACTIVITY_WORK_ORDER_LIST_STATUSES])
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_RECENT_ACTIVITY_LIMIT),
    ])

  if (operational.error) {
    return { data: null, error: mapSupabaseTaskError(operational.error) }
  }

  if (completedToday.error) {
    return { data: null, error: mapSupabaseTaskError(completedToday.error) }
  }

  if (finalizadaCountResult.error) {
    return {
      data: null,
      error: mapSupabaseTaskError(finalizadaCountResult.error),
    }
  }

  if (recentActivity.error) {
    return { data: null, error: mapSupabaseTaskError(recentActivity.error) }
  }

  const projectMetricRows: NonNullable<typeof operational.data> = []
  let projectMetricFrom = 0

  for (;;) {
    const projectMetricPage = await client
      .from("tasks")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("project_id", "is", null)
      .in("status", [...DASHBOARD_PROJECT_METRIC_COMPLETED_STATUSES])
      .order("id", { ascending: true })
      .range(
        projectMetricFrom,
        projectMetricFrom + DASHBOARD_PROJECT_METRIC_PAGE_SIZE - 1
      )

    if (projectMetricPage.error) {
      return {
        data: null,
        error: mapSupabaseTaskError(projectMetricPage.error),
      }
    }

    const pageRows = projectMetricPage.data ?? []
    projectMetricRows.push(...pageRows)

    if (pageRows.length < DASHBOARD_PROJECT_METRIC_PAGE_SIZE) {
      break
    }

    projectMetricFrom += DASHBOARD_PROJECT_METRIC_PAGE_SIZE
  }

  const dashboardTaskRows = new Map<string, (typeof operational.data)[number]>()
  for (const row of operational.data ?? []) {
    dashboardTaskRows.set(row.id, row)
  }
  for (const row of completedToday.data ?? []) {
    dashboardTaskRows.set(row.id, row)
  }
  for (const row of recentActivity.data ?? []) {
    dashboardTaskRows.set(row.id, row)
  }

  const projectMetricIds = new Set(projectMetricRows.map((row) => row.id))
  const allRowsById = new Map(dashboardTaskRows)
  for (const row of projectMetricRows) {
    allRowsById.set(row.id, row)
  }

  const mapped = await mapFetchedTaskRows(client, companyId, [
    ...allRowsById.values(),
  ])
  const dashboardTaskIds = new Set(dashboardTaskRows.keys())

  return {
    data: {
      tasks: mapped.filter((task) => dashboardTaskIds.has(task.id)),
      finalizadaCount: finalizadaCountResult.count ?? 0,
      projectMetricTasks: mapped.filter((task) => projectMetricIds.has(task.id)),
    },
    error: null,
  }
}

/**
 * Archivo de OT (`/operations/archivo-ot`). Paginated; never fetches more than
 * ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE rows. Do not reuse for Planificación,
 * Obras, Dashboard, Mobile, or Órdenes de Trabajo activas.
 */
export async function fetchArchivedWorkOrderListTasks(
  client: SupabaseTasksClient,
  companyId: string,
  input: ArchivedWorkOrderListQuery = {}
): Promise<TasksRepositoryResult<ArchivedWorkOrderListPage<Task>>> {
  const range = resolveArchivedWorkOrderListRange(
    input.page,
    input.pageSize ?? ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE
  )

  if (shouldShortCircuitArchivedWorkOrderObraFilter(input.workOrderType)) {
    return {
      data: {
        items: [],
        total: 0,
        page: range.page,
        pageSize: range.pageSize,
      },
      error: null,
    }
  }

  if (isArchivedWorkOrderPrioritySort(input.sortField)) {
    return fetchArchivedWorkOrderListTasksByPriorityRank(
      client,
      companyId,
      input,
      range.page,
      range.pageSize
    )
  }

  let query = applyArchivedWorkOrderListFilters(
    client.from("tasks").select("*", { count: "exact" }),
    companyId,
    input
  )

  const sortColumn = resolveArchivedWorkOrderListSortColumn(input.sortField)
  const ascending = (input.sortDirection ?? "asc") === "asc"
  query = query.order(sortColumn, { ascending })
  if (sortColumn !== "code") {
    query = query.order("code", { ascending: true })
  }

  const { data, error, count } = await query.range(range.from, range.to)

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: {
      items: await mapFetchedTaskRows(client, companyId, data),
      total: count ?? 0,
      page: range.page,
      pageSize: range.pageSize,
    },
    error: null,
  }
}

function applyArchivedWorkOrderListFilters<
  T extends {
    eq: (column: string, value: string) => T
    is: (column: string, value: null) => T
    or: (filters: string) => T
  },
>(query: T, companyId: string, input: ArchivedWorkOrderListQuery): T {
  let next = query
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .is("project_id", null)
    .eq("status", ARCHIVE_WORK_ORDER_LIST_STATUS)

  const searchOr = buildArchivedWorkOrderSearchOrFilter(input.search ?? "")
  if (searchOr) {
    next = next.or(searchOr)
  }

  if (input.type && input.type !== "all") {
    next = next.eq("type", input.type)
  }

  const workOrderTypeFilter = resolveArchivedWorkOrderTypeFilter(
    input.workOrderType
  )
  if (workOrderTypeFilter) {
    next = next.eq(workOrderTypeFilter.column, workOrderTypeFilter.value)
  }

  if (input.priority && input.priority !== "all") {
    next = next.eq("priority", input.priority)
  }

  if (input.crewId && input.crewId !== "all") {
    const crewName = input.crewName?.trim()
    if (crewName) {
      next = next.or(
        `crew_id.eq.${input.crewId},and(crew_id.is.null,crew.eq.${quotePostgrestFilterValue(crewName)})`
      )
    } else {
      next = next.eq("crew_id", input.crewId)
    }
  }

  return next
}

async function fetchArchivedWorkOrderListTasksByPriorityRank(
  client: SupabaseTasksClient,
  companyId: string,
  input: ArchivedWorkOrderListQuery,
  page: number,
  pageSize: number
): Promise<TasksRepositoryResult<ArchivedWorkOrderListPage<Task>>> {
  const sequence = resolveArchivedWorkOrderPrioritySequence(input.sortDirection)
  const countResults = await Promise.all(
    sequence.map(async (priority) => {
      const { error, count } = await applyArchivedWorkOrderListFilters(
        client.from("tasks").select("id", { count: "exact", head: true }),
        companyId,
        input
      ).eq("priority", priority)

      return { priority, count: count ?? 0, error }
    })
  )

  const countError = countResults.find((result) => result.error)?.error
  if (countError) {
    return { data: null, error: mapSupabaseTaskError(countError) }
  }

  const counts = {
    alta: 0,
    media: 0,
    baja: 0,
  } satisfies Record<TaskPriority, number>

  for (const result of countResults) {
    counts[result.priority] = result.count
  }

  const total = counts.alta + counts.media + counts.baja
  const slices = resolveArchivedWorkOrderPriorityBucketSlices(
    page,
    pageSize,
    counts,
    input.sortDirection ?? "asc"
  )

  const pages = await Promise.all(
    slices.map(async (slice) => {
      const { data, error } = await applyArchivedWorkOrderListFilters(
        client.from("tasks").select("*"),
        companyId,
        input
      )
        .eq("priority", slice.priority)
        .order("code", { ascending: true })
        .range(slice.from, slice.to)

      return { data, error, slice }
    })
  )

  const pageError = pages.find((result) => result.error)?.error
  if (pageError) {
    return { data: null, error: mapSupabaseTaskError(pageError) }
  }

  const rows = pages.flatMap((result) => result.data ?? [])

  return {
    data: {
      items: await mapFetchedTaskRows(client, companyId, rows),
      total,
      page,
      pageSize,
    },
    error: null,
  }
}

function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
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

/** PostgREST max_rows page size for ID lookups in vencida sync. */
export const VENCIDA_SYNC_TASK_ID_PAGE_SIZE = 1000

/**
 * Dedupes requested IDs and splits them so each PostgREST `.in("id")`
 * stays within max_rows. Used only by POST /api/tasks/sync-vencida.
 */
export function chunkVencidaSyncTaskIds(
  taskIds: readonly string[],
  pageSize = VENCIDA_SYNC_TASK_ID_PAGE_SIZE
): string[][] {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const raw of taskIds) {
    const id = raw.trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    unique.push(id)
  }

  const chunks: string[][] = []
  for (let from = 0; from < unique.length; from += pageSize) {
    chunks.push(unique.slice(from, from + pageSize))
  }
  return chunks
}

/**
 * Loads the requested OT rows for auto-vencida sync.
 * Tenant-scoped by company_id; never uses fetchTasks() / due_date ordering.
 * Pages by ID so more than 1000 requested IDs are not truncated.
 */
export async function fetchTasksByIdsForVencidaSync(
  client: SupabaseTasksClient,
  companyId: string,
  taskIds: readonly string[]
): Promise<TasksRepositoryResult<Task[]>> {
  const chunks = chunkVencidaSyncTaskIds(taskIds)

  if (chunks.length === 0) {
    return { data: [], error: null }
  }

  const rows: TaskRow[] = []

  for (const chunk of chunks) {
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("id", chunk)

    if (error) {
      return { data: null, error: mapSupabaseTaskError(error) }
    }

    rows.push(...((data ?? []) as TaskRow[]))
  }

  return {
    data: rows.map(mapTaskRowToTask),
    error: null,
  }
}

function applyOperarioWebCrewFilter<
  T extends {
    or: (filter: string) => T
    eq: (column: string, value: string) => T
    maybeSingle?: () => PromiseLike<{ data: unknown; error: unknown }>
  },
>(query: T, crew: OperarioWebCrewRef): T {
  const crewId = crew.id?.trim() ?? ""
  const crewName = crew.name.trim()

  if (crewId && crewName) {
    return query.or(
      `crew_id.eq.${crewId},and(crew_id.is.null,crew.eq.${quotePostgrestFilterValue(crewName)})`
    )
  }

  if (crewId) {
    return query.eq("crew_id", crewId)
  }

  return query.eq("crew", crewName)
}

/**
 * Operario Web Hoy (`/operario`). Crew-scoped operational statuses so
 * PostgREST max_rows=1000 cannot hide today's OT behind historical
 * finalizadas. Date visibility stays in lib/data/operario.ts.
 * Do not reuse for Mobile, /tareas, Dashboard, or Historial.
 */
export async function fetchOperarioTodayWorkOrderListTasks(
  client: SupabaseTasksClient,
  companyId: string,
  crew: OperarioWebCrewRef
): Promise<TasksRepositoryResult<Task[]>> {
  if (!hasOperarioWebCrew(crew)) {
    return { data: [], error: null }
  }

  const { data, error } = await applyOperarioWebCrewFilter(
    client
      .from("tasks")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("status", [...OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES]),
    crew
  )

  if (error) {
    return { data: null, error: mapSupabaseTaskError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskRowToTask),
    error: null,
  }
}

/**
 * Operario Web detail (`/operario/tarea/[id]`). Tenant + id + crew lookup;
 * does not call fetchTasks. Caller must still apply
 * isOperarioWorkerTaskAccessible (today vs history).
 */
export async function fetchOperarioWebWorkOrderById(
  client: SupabaseTasksClient,
  companyId: string,
  taskId: string,
  crew: OperarioWebCrewRef
): Promise<TasksRepositoryResult<Task>> {
  if (!hasOperarioWebCrew(crew)) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Orden de trabajo no encontrada.",
      },
    }
  }

  const { data, error } = await applyOperarioWebCrewFilter(
    client
      .from("tasks")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", taskId)
      .is("deleted_at", null),
    crew
  ).maybeSingle()

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
): Promise<TasksRepositoryResult<InsertTaskResult>> {
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

  const idempotencyKey = insertPayload.idempotencyKey?.trim() || ""
  const rpcResult = idempotencyKey
    ? await client.rpc("create_work_order_idempotent", {
        p_payload: buildCreateWorkOrderIdempotentRpcPayload(
          mapped as unknown as Record<string, unknown>,
          insertPayload
        ),
      })
    : await client.rpc("create_task_with_execution_order", {
        p_payload: mapped as unknown as Json,
      })

  const { data, error } = rpcResult

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

  const parsed = parseCreateWorkOrderIdempotentResponse(data)
  if (!parsed) {
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: "No fue posible crear la orden de trabajo. Intente nuevamente.",
      },
    }
  }

  const created = mapTaskRowToTask(parsed.task as TaskRow)

  return {
    data: toCreateWorkOrderIdempotentResult(created, {
      created: parsed.created,
      idempotentReplay: parsed.idempotentReplay,
    }),
    error: null,
  }
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
