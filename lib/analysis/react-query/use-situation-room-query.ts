"use client"

import { useQuery } from "@tanstack/react-query"

import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"
import {
  fetchSituationRoom,
  type SituationRoomQueryResult,
} from "@/lib/executive/fetch-situation-room.client"

async function fetchSituationRoomOrThrow(
  date: string
): Promise<SituationRoomQueryResult> {
  const result = await fetchSituationRoom(date)
  if (!result.success) {
    throw new Error(result.message)
  }
  return result.data
}

/**
 * Sala de Situación (+ Resumen Diario) — shared cache by date.
 */
export function useSituationRoomQuery(date: string, enabled: boolean) {
  return useQuery({
    queryKey: analysisQueryKeys.situationRoom(date),
    queryFn: () => fetchSituationRoomOrThrow(date),
    enabled: Boolean(enabled && date),
  })
}
