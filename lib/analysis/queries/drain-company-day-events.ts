import "server-only"

import {
  ACTIVITY_QUERY_MAX_LIMIT,
  getActivityEvents,
  type ActivityEvent,
} from "@/lib/activity/query-service"

/**
 * Batch-drain company-day activity events for Análisis APIs (Sprint 17).
 * Uses max page size to minimize sequential round-trips (no N+1 per entity).
 * Does not change Activity Engine — only consumes getActivityEvents.
 */
export async function drainAnalysisCompanyDayEvents(input: {
  companyId: string
  dateFrom: string
  dateTo: string
}): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const page = await getActivityEvents({
      companyId: input.companyId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      order: "ASC",
      limit: ACTIVITY_QUERY_MAX_LIMIT,
      offset,
    })
    events.push(...page.items)
    hasMore = page.hasMore
    offset += page.items.length
    if (page.items.length === 0) break
  }

  return events
}
