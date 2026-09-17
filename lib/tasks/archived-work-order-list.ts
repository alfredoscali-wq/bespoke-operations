import { escapeCustomerSearchPattern } from "@/lib/customers/customer-list"
import {
  ARCHIVE_WORK_ORDER_LIST_STATUS,
  matchesArchivedWorkOrderListQuery,
} from "@/lib/tasks/task-list-scope"
import {
  WORK_ORDER_OT_TYPE_FILTER_MAINTENANCE,
  WORK_ORDER_OT_TYPE_FILTER_OBRA,
  type WorkOrderOtTypeFilterValue,
} from "@/lib/tasks/work-order-ot-type-filter"
import type {
  TaskPriority,
  TaskSortDirection,
  TaskSortField,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"

export const ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE = 50

export const ARCHIVE_WORK_ORDER_SEARCH_COLUMNS = [
  "code",
  "work_order_number",
  "title",
  "project_code",
  "project_name",
  "customer_name",
  "customer_company",
  "service_address",
  "locality",
  "customer_phone",
  "observations_for_crew",
  "description",
  "cancellation_reason",
  "cancellation_observation",
  "reschedule_reason",
  "reschedule_notes",
] as const

export type ArchivedWorkOrderListQuery = {
  page?: number
  pageSize?: number
  search?: string
  type?: TaskType | "all"
  workOrderType?: WorkOrderOtTypeFilterValue
  priority?: TaskPriority | "all"
  crewId?: string | "all"
  crewName?: string | null
  sortField?: TaskSortField
  sortDirection?: TaskSortDirection
}

export type ArchivedWorkOrderListPage<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type ArchivedWorkOrderListRange = {
  page: number
  pageSize: number
  from: number
  to: number
}

type ArchivedWorkOrderListRow = {
  status: TaskStatus
  projectId?: string | null
  deletedAt?: string | null
  dueDate: string
  code?: string
}

const SORT_COLUMN_BY_FIELD: Record<Exclude<TaskSortField, "priority">, string> =
  {
    dueDate: "due_date",
    code: "code",
    progress: "progress",
    status: "due_date",
  }

/** Same ranking as the previous frontend list: alta > media > baja. */
export const ARCHIVE_WORK_ORDER_PRIORITY_RANK: Record<TaskPriority, number> = {
  alta: 3,
  media: 2,
  baja: 1,
}

export function resolveArchivedWorkOrderListRange(
  page = 1,
  pageSize = ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE
): ArchivedWorkOrderListRange {
  const safePageSize = Math.min(
    ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE,
    Math.max(1, Math.floor(pageSize) || ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE)
  )
  const safePage = Math.max(1, Math.floor(page) || 1)
  const from = (safePage - 1) * safePageSize

  return {
    page: safePage,
    pageSize: safePageSize,
    from,
    to: from + safePageSize - 1,
  }
}

export function paginateArchivedWorkOrderListRows<
  T extends ArchivedWorkOrderListRow,
>(
  rows: T[],
  page = 1,
  pageSize = ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE
): ArchivedWorkOrderListPage<T> {
  const matching = rows
    .filter(matchesArchivedWorkOrderListQuery)
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        (left.code ?? "").localeCompare(right.code ?? "")
    )
  const range = resolveArchivedWorkOrderListRange(page, pageSize)

  return {
    items: matching.slice(range.from, range.to + 1),
    total: matching.length,
    page: range.page,
    pageSize: range.pageSize,
  }
}

export function buildArchivedWorkOrderSearchOrFilter(
  search: string
): string | null {
  const normalized = search.trim()
  if (!normalized) {
    return null
  }

  const pattern = escapeCustomerSearchPattern(normalized)
  return ARCHIVE_WORK_ORDER_SEARCH_COLUMNS.map(
    (column) => `${column}.ilike.${pattern}`
  ).join(",")
}

export function resolveArchivedWorkOrderListSortColumn(
  sortField: TaskSortField = "dueDate"
): string {
  if (sortField === "priority") {
    return "due_date"
  }

  return SORT_COLUMN_BY_FIELD[sortField] ?? "due_date"
}

export function isArchivedWorkOrderPrioritySort(
  sortField?: TaskSortField
): boolean {
  return sortField === "priority"
}

/**
 * Previous frontend Array.sort used alta=3, media=2, baja=1.
 * Ascendente → baja, media, alta. Descendente → alta, media, baja.
 */
export function resolveArchivedWorkOrderPrioritySequence(
  sortDirection: TaskSortDirection = "asc"
): TaskPriority[] {
  return sortDirection === "desc"
    ? ["alta", "media", "baja"]
    : ["baja", "media", "alta"]
}

export type ArchivedWorkOrderPriorityBucketSlice = {
  priority: TaskPriority
  from: number
  to: number
}

export function resolveArchivedWorkOrderPriorityBucketSlices(
  page: number,
  pageSize: number,
  counts: Record<TaskPriority, number>,
  sortDirection: TaskSortDirection = "asc"
): ArchivedWorkOrderPriorityBucketSlice[] {
  const range = resolveArchivedWorkOrderListRange(page, pageSize)
  const sequence = resolveArchivedWorkOrderPrioritySequence(sortDirection)
  const slices: ArchivedWorkOrderPriorityBucketSlice[] = []
  let cursor = 0

  for (const priority of sequence) {
    const count = Math.max(0, counts[priority] ?? 0)
    const bucketStart = cursor
    const bucketEnd = cursor + count
    cursor = bucketEnd

    const overlapStart = Math.max(range.from, bucketStart)
    const overlapEnd = Math.min(range.to + 1, bucketEnd)

    if (overlapStart < overlapEnd) {
      slices.push({
        priority,
        from: overlapStart - bucketStart,
        to: overlapEnd - bucketStart - 1,
      })
    }
  }

  return slices
}

export function paginateArchivedWorkOrderListRowsByPriority<
  T extends ArchivedWorkOrderListRow & { priority: TaskPriority },
>(
  rows: T[],
  page = 1,
  pageSize = ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE,
  sortDirection: TaskSortDirection = "asc"
): ArchivedWorkOrderListPage<T> {
  const matching = rows.filter(matchesArchivedWorkOrderListQuery)
  const sequence = resolveArchivedWorkOrderPrioritySequence(sortDirection)
  const ordered = sequence.flatMap((priority) =>
    matching
      .filter((row) => row.priority === priority)
      .sort((left, right) => (left.code ?? "").localeCompare(right.code ?? ""))
  )
  const range = resolveArchivedWorkOrderListRange(page, pageSize)

  return {
    items: ordered.slice(range.from, range.to + 1),
    total: ordered.length,
    page: range.page,
    pageSize: range.pageSize,
  }
}

export function shouldShortCircuitArchivedWorkOrderObraFilter(
  workOrderType: WorkOrderOtTypeFilterValue = "all"
): boolean {
  return workOrderType === WORK_ORDER_OT_TYPE_FILTER_OBRA
}

export function resolveArchivedWorkOrderTypeFilter(
  workOrderType: WorkOrderOtTypeFilterValue = "all"
): { column: "type" | "service_type"; value: string } | null {
  if (
    workOrderType === "all" ||
    workOrderType === WORK_ORDER_OT_TYPE_FILTER_OBRA
  ) {
    return null
  }

  if (workOrderType === WORK_ORDER_OT_TYPE_FILTER_MAINTENANCE) {
    return { column: "type", value: "maintenance" }
  }

  return { column: "service_type", value: workOrderType }
}

export function buildArchivePaginationItems(
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis"> {
  const safeTotal = Math.max(1, totalPages)
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal)

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1)
  }

  const items: Array<number | "ellipsis"> = [1]
  const start = Math.max(2, safeCurrent - 1)
  const end = Math.min(safeTotal - 1, safeCurrent + 1)

  if (start > 2) {
    items.push("ellipsis")
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page)
  }

  if (end < safeTotal - 1) {
    items.push("ellipsis")
  }

  items.push(safeTotal)
  return items
}

export function formatArchivedWorkOrderRangeLabel(
  page: number,
  pageSize: number,
  total: number
): string {
  if (total === 0) {
    return "Mostrando 0 de 0"
  }

  const range = resolveArchivedWorkOrderListRange(page, pageSize)
  const start = range.from + 1
  const end = Math.min(range.to + 1, total)
  return `Mostrando ${start}–${end} de ${total}`
}

export { ARCHIVE_WORK_ORDER_LIST_STATUS, matchesArchivedWorkOrderListQuery }
