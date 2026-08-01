/**
 * Planning read-model cache defaults (Sprint 19).
 * Aligned with Análisis RQ defaults — prefer cache over chatter.
 */

export const PLANNING_READ_STALE_TIME_MS = 60_000
export const PLANNING_READ_GC_TIME_MS = 10 * 60_000

export const PLANNING_READ_QUERY_DEFAULTS = {
  staleTime: PLANNING_READ_STALE_TIME_MS,
  gcTime: PLANNING_READ_GC_TIME_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
  retry: 0,
} as const
