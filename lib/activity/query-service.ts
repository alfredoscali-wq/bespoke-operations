import "server-only"

import { expandActivityModuleFilter } from "@/lib/indicators/module-aliases"
import { createClient } from "@/lib/supabase/server"

const ACTIVITY_SELECT = [
  "id",
  "company_id",
  "employee_id",
  "app_user_id",
  "module",
  "entity_type",
  "entity_id",
  "action",
  "title",
  "description",
  "metadata",
  "created_at",
  "deleted_at",
].join(", ")

export const ACTIVITY_QUERY_DEFAULT_LIMIT = 50
export const ACTIVITY_QUERY_MAX_LIMIT = 200

export type ActivityQueryOrder = "ASC" | "DESC"

export type ActivityEvent = {
  id: string
  companyId: string
  employeeId: string | null
  appUserId: string | null
  module: string
  entityType: string
  entityId: string | null
  action: string
  title: string
  description: string | null
  metadata: Record<string, unknown>
  createdAt: string
  deletedAt: string | null
}

export type ActivityQueryFilters = {
  companyId: string
  employeeId?: string | null
  module?: string | null
  entityType?: string | null
  entityId?: string | null
  action?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  /** Free-text match against title, description, action, and entity IDs. */
  search?: string | null
  limit?: number
  offset?: number
  order?: ActivityQueryOrder
}

export type ActivityQueryResult = {
  items: ActivityEvent[]
  total: number
  hasMore: boolean
}

export type EmployeeActivityQuery = Omit<
  ActivityQueryFilters,
  "employeeId"
> & {
  employeeId: string
}

export type CustomerActivityQuery = Omit<
  ActivityQueryFilters,
  "entityType" | "entityId"
> & {
  customerId: string
}

export type RequestActivityQuery = Omit<
  ActivityQueryFilters,
  "module" | "entityType" | "entityId"
> & {
  requestId: string
}

export type WorkOrderActivityQuery = Omit<
  ActivityQueryFilters,
  "module" | "entityType" | "entityId"
> & {
  workOrderId: string
}

export type ProjectActivityQuery = Omit<
  ActivityQueryFilters,
  "module" | "entityType" | "entityId"
> & {
  projectId: string
}

type ActivityEventDbRow = {
  id: string
  company_id: string
  employee_id: string | null
  app_user_id: string | null
  module: string
  entity_type: string
  entity_id: string | null
  action: string
  title: string
  description: string | null
  metadata: unknown
  created_at: string
  deleted_at: string | null
}

type ActivityQueryResponse = {
  data: ActivityEventDbRow[] | null
  error: { message: string } | null
  count: number | null
}

type ActivityQueryBuilder = {
  eq(column: string, value: string): ActivityQueryBuilder
  in(column: string, values: string[]): ActivityQueryBuilder
  gte(column: string, value: string): ActivityQueryBuilder
  lte(column: string, value: string): ActivityQueryBuilder
  is(column: string, value: null): ActivityQueryBuilder
  or(filters: string): ActivityQueryBuilder
  order(
    column: string,
    options: { ascending: boolean }
  ): ActivityQueryBuilder
  range(from: number, to: number): Promise<ActivityQueryResponse>
}

export type ActivityQueryClient = {
  from(table: "activity_events"): {
    select(
      columns: string,
      options: { count: "exact" }
    ): ActivityQueryBuilder
  }
}

type NormalizedActivityQuery = Omit<
  ActivityQueryFilters,
  "companyId" | "limit" | "offset" | "order"
> & {
  companyId: string
  limit: number
  offset: number
  order: ActivityQueryOrder
}

function requiredValue(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`Activity Query Engine: ${field} es obligatorio.`)
  }
  return normalized
}

function optionalValue(value: string | null | undefined): string | undefined {
  const normalized = value?.trim() ?? ""
  return normalized || undefined
}

function escapeIlikePattern(value: string): string {
  return value
    .replace(/,/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/"/g, "")
    .trim()
}

function assertValidDate(value: string | undefined, field: string): void {
  if (value && Number.isNaN(Date.parse(value))) {
    throw new Error(`Activity Query Engine: ${field} no es una fecha válida.`)
  }
}

function normalizeQuery(input: ActivityQueryFilters): NormalizedActivityQuery {
  const dateFrom = optionalValue(input.dateFrom)
  const dateTo = optionalValue(input.dateTo)

  assertValidDate(dateFrom, "dateFrom")
  assertValidDate(dateTo, "dateTo")

  if (
    dateFrom &&
    dateTo &&
    new Date(dateFrom).getTime() > new Date(dateTo).getTime()
  ) {
    throw new Error(
      "Activity Query Engine: dateFrom no puede ser posterior a dateTo."
    )
  }

  const requestedLimit = Number.isFinite(input.limit)
    ? Math.floor(input.limit ?? ACTIVITY_QUERY_DEFAULT_LIMIT)
    : ACTIVITY_QUERY_DEFAULT_LIMIT
  const requestedOffset = Number.isFinite(input.offset)
    ? Math.floor(input.offset ?? 0)
    : 0
  const order = input.order ?? "DESC"

  if (order !== "ASC" && order !== "DESC") {
    throw new Error("Activity Query Engine: order debe ser ASC o DESC.")
  }

  return {
    companyId: requiredValue(input.companyId, "companyId"),
    employeeId: optionalValue(input.employeeId),
    module: optionalValue(input.module),
    entityType: optionalValue(input.entityType),
    entityId: optionalValue(input.entityId),
    action: optionalValue(input.action),
    dateFrom,
    dateTo,
    search: optionalValue(input.search),
    limit: Math.min(
      Math.max(requestedLimit, 1),
      ACTIVITY_QUERY_MAX_LIMIT
    ),
    offset: Math.max(requestedOffset, 0),
    order,
  }
}

function mapEvent(row: ActivityEventDbRow): ActivityEvent {
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    appUserId: row.app_user_id,
    module: row.module,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    title: row.title,
    description: row.description,
    metadata,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  }
}

async function resolveQueryClient(
  client?: ActivityQueryClient
): Promise<ActivityQueryClient> {
  if (client) return client
  return (await createClient()) as unknown as ActivityQueryClient
}

/**
 * Common Activity Query Engine entry point.
 *
 * The authenticated Supabase server client preserves RLS, while the mandatory
 * company filter provides defense in depth against cross-company reads.
 */
export async function getActivityEvents(
  input: ActivityQueryFilters,
  client?: ActivityQueryClient
): Promise<ActivityQueryResult> {
  const filters = normalizeQuery(input)
  const queryClient = await resolveQueryClient(client)

  let query = queryClient
    .from("activity_events")
    .select(ACTIVITY_SELECT, { count: "exact" })
    .eq("company_id", filters.companyId)
    .is("deleted_at", null)

  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId)
  }
  if (filters.module) {
    const modules = expandActivityModuleFilter(filters.module)
    if (modules.length === 1) {
      query = query.eq("module", modules[0]!)
    } else if (modules.length > 1) {
      query = query.in("module", modules)
    }
  }
  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType)
  }
  if (filters.entityId) {
    query = query.eq("entity_id", filters.entityId)
  }
  if (filters.action) {
    query = query.eq("action", filters.action)
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo)
  }
  if (filters.search) {
    const term = escapeIlikePattern(filters.search)
    if (term) {
      const pattern = `"%${term}%"`
      query = query.or(
        [
          `title.ilike.${pattern}`,
          `description.ilike.${pattern}`,
          `action.ilike.${pattern}`,
          `entity_id.ilike.${pattern}`,
          `employee_id.ilike.${pattern}`,
        ].join(",")
      )
    }
  }

  const from = filters.offset
  const to = from + filters.limit - 1
  const { data, error, count } = await query
    .order("created_at", { ascending: filters.order === "ASC" })
    .range(from, to)

  if (error) {
    throw new Error(
      `Activity Query Engine: no se pudieron consultar los eventos: ${error.message}`
    )
  }

  const items = (data ?? []).map(mapEvent)
  const total = count ?? 0

  return {
    items,
    total,
    hasMore: filters.offset + items.length < total,
  }
}

export function getEmployeeActivity(
  input: EmployeeActivityQuery,
  client?: ActivityQueryClient
): Promise<ActivityQueryResult> {
  return getActivityEvents(
    {
      ...input,
      employeeId: requiredValue(input.employeeId, "employeeId"),
    },
    client
  )
}

export function getCustomerActivity(
  input: CustomerActivityQuery,
  client?: ActivityQueryClient
): Promise<ActivityQueryResult> {
  return getActivityEvents(
    {
      ...input,
      entityType: "customer",
      entityId: requiredValue(input.customerId, "customerId"),
    },
    client
  )
}

export function getRequestActivity(
  input: RequestActivityQuery,
  client?: ActivityQueryClient
): Promise<ActivityQueryResult> {
  return getActivityEvents(
    {
      ...input,
      module: "requests",
      entityType: "request",
      entityId: requiredValue(input.requestId, "requestId"),
    },
    client
  )
}

export function getWorkOrderActivity(
  input: WorkOrderActivityQuery,
  client?: ActivityQueryClient
): Promise<ActivityQueryResult> {
  return getActivityEvents(
    {
      ...input,
      module: "tasks",
      entityId: requiredValue(input.workOrderId, "workOrderId"),
    },
    client
  )
}

export function getProjectActivity(
  input: ProjectActivityQuery,
  client?: ActivityQueryClient
): Promise<ActivityQueryResult> {
  return getActivityEvents(
    {
      ...input,
      module: "projects",
      entityType: "project",
      entityId: requiredValue(input.projectId, "projectId"),
    },
    client
  )
}
