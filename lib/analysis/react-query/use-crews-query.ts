"use client"

import { useQuery } from "@tanstack/react-query"

import {
  fetchCrewsScreen,
  type CrewsQueryResult,
} from "@/lib/analysis/crews/fetch-crews.client"
import { resolveCrewsPeriodRange } from "@/lib/analysis/crews/period"
import type { AnalysisDateRangeValue } from "@/lib/analysis/date-range"
import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"

async function fetchCrewsOrThrow(
  range: AnalysisDateRangeValue
): Promise<CrewsQueryResult> {
  const result = await fetchCrewsScreen({
    preset: range.preset,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  })
  if (!result.success) {
    throw new Error(result.message)
  }
  return result.data
}

/**
 * Query key always includes the resolved inclusive range so caches
 * from another period are never reused.
 */
export function useCrewsQuery(range: AnalysisDateRangeValue, enabled: boolean) {
  const resolved = resolveCrewsPeriodRange({
    preset: range.preset,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  })

  return useQuery({
    queryKey: analysisQueryKeys.cuadrillas(
      resolved.preset,
      resolved.dateFrom,
      resolved.dateTo
    ),
    queryFn: () =>
      fetchCrewsOrThrow({
        preset: resolved.preset,
        dateFrom: resolved.dateFrom,
        dateTo: resolved.dateTo,
      }),
    enabled: Boolean(
      enabled && resolved.dateFrom && resolved.dateTo
    ),
  })
}
