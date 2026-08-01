"use client"

import { useQuery } from "@tanstack/react-query"

import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"
import {
  fetchCrewProduction,
  type CrewProductionQueryResult,
} from "@/lib/analysis/crew-production/fetch-crew-production.client"

async function fetchCrewProductionOrThrow(
  date: string
): Promise<CrewProductionQueryResult> {
  const result = await fetchCrewProduction(date)
  if (!result.success) {
    throw new Error(result.message)
  }
  return result.data
}

/**
 * Producción de Cuadrillas — one Read Model per date (React Query cache).
 */
export function useCrewProductionQuery(date: string, enabled: boolean) {
  return useQuery({
    queryKey: analysisQueryKeys.crewProduction(date),
    queryFn: () => fetchCrewProductionOrThrow(date),
    enabled: Boolean(enabled && date),
  })
}
