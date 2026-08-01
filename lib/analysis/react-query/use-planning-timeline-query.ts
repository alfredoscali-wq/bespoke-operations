"use client"

import { useQuery } from "@tanstack/react-query"

import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"
import {
  fetchPlanningTimeline,
  type PlanningTimelineQueryResult,
} from "@/lib/analysis/planning-timeline/fetch-planning-timeline.client"

async function fetchPlanningTimelineOrThrow(input: {
  date: string
  crewId: string
}): Promise<PlanningTimelineQueryResult> {
  const result = await fetchPlanningTimeline(input)
  if (!result.success) {
    throw new Error(result.message)
  }
  return result.data
}

/**
 * Timeline Operativo — one PlanningTimelineReadModel per date+crew.
 */
export function usePlanningTimelineQuery(
  input: { date: string; crewId: string },
  enabled: boolean
) {
  return useQuery({
    queryKey: analysisQueryKeys.planningTimeline(input.date, input.crewId),
    queryFn: () => fetchPlanningTimelineOrThrow(input),
    enabled: Boolean(enabled && input.date && input.crewId),
  })
}
