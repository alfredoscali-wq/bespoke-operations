import type {
  ActivityViewerQueryResult,
  ActivityViewerStats,
} from "@/lib/activity/activity-viewer-types"

type ActivityFetchResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

export async function fetchActivityViewerEvents(
  params: URLSearchParams
): Promise<ActivityFetchResult<ActivityViewerQueryResult>> {
  const response = await fetch(`/api/activity/events?${params.toString()}`)
  const payload = (await response.json()) as ActivityViewerQueryResult & {
    success?: boolean
    message?: string
  }

  if (!response.ok || !payload.success) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar Activity Engine.",
    }
  }

  return {
    success: true,
    data: {
      entries: payload.entries,
      total: payload.total,
      offset: payload.offset,
      limit: payload.limit,
      hasMore: payload.hasMore,
    },
  }
}

export async function fetchActivityViewerStats(): Promise<
  ActivityFetchResult<ActivityViewerStats>
> {
  const response = await fetch("/api/activity/stats")
  const payload = (await response.json()) as ActivityViewerStats & {
    success?: boolean
    message?: string
  }

  if (!response.ok || !payload.success) {
    return {
      success: false,
      message:
        payload.message ?? "No se pudieron cargar los indicadores de Activity.",
    }
  }

  return {
    success: true,
    data: {
      eventsToday: payload.eventsToday,
      eventsLastHour: payload.eventsLastHour,
      activeUsersToday: payload.activeUsersToday,
      modulesActiveToday: payload.modulesActiveToday,
    },
  }
}
