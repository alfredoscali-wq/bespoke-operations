"use client"

import { useQuery } from "@tanstack/react-query"

import {
  fetchExecutiveCenter,
  type ExecutiveCenterQueryResult,
} from "@/lib/analysis/executive-center/fetch-executive-center.client"
import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"

async function fetchExecutiveCenterOrThrow(
  date: string
): Promise<ExecutiveCenterQueryResult> {
  const result = await fetchExecutiveCenter(date)
  if (!result.success) {
    throw new Error(result.message)
  }
  return result.data
}

export function useExecutiveCenterQuery(date: string, enabled: boolean) {
  return useQuery({
    queryKey: analysisQueryKeys.executiveCenter(date),
    queryFn: () => fetchExecutiveCenterOrThrow(date),
    enabled: Boolean(enabled && date),
  })
}
