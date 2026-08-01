/**
 * Client-side timeline drain helpers for Análisis (Sprint 17).
 * Max page size → fewer sequential HTTP round-trips. No per-id queries.
 */

import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import type {
  ActivityTimelineEvent,
  ActivityTimelineScope,
} from "@/lib/activity/activity-timeline-types"
import { fetchActivityTimeline } from "@/lib/activity/fetch-activity-timeline.client"
import { scopeToTimelineFilters } from "@/lib/activity/fetch-activity-timeline.client"

/** Matches Activity Query Engine max page size. */
export const ANALYSIS_TIMELINE_DRAIN_PAGE_SIZE = 200

export async function drainAnalysisTimelineEvents(input: {
  scope: ActivityTimelineScope
  dateFromInput: string
  dateToInput: string
}): Promise<ActivityTimelineEvent[]> {
  const dateFrom = toTimelineDateFromInput(input.dateFromInput)
  const dateTo = toTimelineDateToInput(input.dateToInput)
  const scopeFilters = scopeToTimelineFilters(input.scope)
  const items: ActivityTimelineEvent[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const result = await fetchActivityTimeline({
      ...scopeFilters,
      dateFrom,
      dateTo,
      order: "ASC",
      limit: ANALYSIS_TIMELINE_DRAIN_PAGE_SIZE,
      offset,
      includeStats: false,
    })
    if (!result.success) {
      throw new Error(result.message)
    }
    const seen = new Set(items.map((item) => item.id))
    for (const item of result.data.items) {
      if (!seen.has(item.id)) items.push(item)
    }
    hasMore = result.data.hasMore
    offset = items.length
    if (result.data.items.length === 0) break
  }

  return items
}
