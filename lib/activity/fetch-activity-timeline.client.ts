import {
  ACTIVITY_TIMELINE_PAGE_SIZE,
  type ActivityTimelineFilters,
  type ActivityTimelineQueryResult,
  type ActivityTimelineScope,
} from "@/lib/activity/activity-timeline-types"

type ActivityTimelineFetchResult =
  | { success: true; data: ActivityTimelineQueryResult }
  | { success: false; message: string }

export function scopeToTimelineFilters(
  scope: ActivityTimelineScope
): Pick<
  ActivityTimelineFilters,
  "employeeId" | "entityType" | "entityId" | "module" | "scope"
> {
  if (scope.kind === "global") {
    return { scope: "global" }
  }
  if (scope.kind === "employee") {
    return {
      scope: "employee",
      employeeId: scope.employeeId,
    }
  }
  return {
    scope: "entity",
    entityType: scope.entityType,
    entityId: scope.entityId,
    module: scope.module,
  }
}

export function buildActivityTimelineSearchParams(
  filters: ActivityTimelineFilters & { includeStats?: boolean }
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.scope?.trim()) {
    params.set("scope", filters.scope.trim())
  }
  if (filters.employeeId?.trim()) {
    params.set("employeeId", filters.employeeId.trim())
  }
  if (filters.module?.trim()) {
    params.set("module", filters.module.trim())
  }
  if (filters.entityType?.trim()) {
    params.set("entityType", filters.entityType.trim())
  }
  if (filters.entityId?.trim()) {
    params.set("entityId", filters.entityId.trim())
  }
  if (filters.action?.trim()) {
    params.set("action", filters.action.trim())
  }
  if (filters.dateFrom?.trim()) {
    params.set("dateFrom", filters.dateFrom.trim())
  }
  if (filters.dateTo?.trim()) {
    params.set("dateTo", filters.dateTo.trim())
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim())
  }
  if (filters.order === "ASC" || filters.order === "DESC") {
    params.set("order", filters.order)
  }

  params.set("limit", String(filters.limit ?? ACTIVITY_TIMELINE_PAGE_SIZE))
  params.set("offset", String(filters.offset ?? 0))

  if (filters.includeStats === false) {
    params.set("includeStats", "0")
  }

  return params
}

export async function fetchActivityTimeline(
  filters: ActivityTimelineFilters & { includeStats?: boolean }
): Promise<ActivityTimelineFetchResult> {
  const params = buildActivityTimelineSearchParams(filters)
  const response = await fetch(`/api/activity/timeline?${params.toString()}`)
  const payload = (await response.json()) as ActivityTimelineQueryResult & {
    success?: boolean
    message?: string
  }

  if (!response.ok || !payload.success) {
    return {
      success: false,
      message:
        payload.message ?? "No se pudo cargar el timeline de Activity Engine.",
    }
  }

  return {
    success: true,
    data: {
      items: payload.items ?? [],
      total: payload.total ?? 0,
      hasMore: Boolean(payload.hasMore),
      limit: payload.limit ?? ACTIVITY_TIMELINE_PAGE_SIZE,
      offset: payload.offset ?? 0,
      stats: payload.stats ?? {
        total: payload.total ?? 0,
        firstEventAt: null,
        lastEventAt: payload.items?.[0]?.createdAt ?? null,
      },
    },
  }
}
