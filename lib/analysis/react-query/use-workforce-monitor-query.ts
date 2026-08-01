"use client"

import { useQuery } from "@tanstack/react-query"

import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"
import {
  fetchWorkforceMonitor,
  type WorkforceMonitorQueryResult,
} from "@/lib/activity/fetch-workforce-monitor.client"

async function fetchWorkforceMonitorOrThrow(
  date: string
): Promise<WorkforceMonitorQueryResult> {
  const result = await fetchWorkforceMonitor(date)
  if (!result.success) {
    throw new Error(result.message)
  }
  return result.data
}

/**
 * Workforce Monitor — cached by date (same stale/gc defaults as Análisis).
 */
export function useWorkforceMonitorQuery(date: string, enabled: boolean) {
  return useQuery({
    queryKey: analysisQueryKeys.workforceMonitor(date),
    queryFn: () => fetchWorkforceMonitorOrThrow(date),
    enabled: Boolean(enabled && date),
  })
}
