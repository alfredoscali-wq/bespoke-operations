/**
 * React Query defaults for Análisis (Sprint 15).
 * Tuned for an internal operations console — prefer cache over chatter.
 */

/** Day snapshots stay fresh for a minute of operator navigation. */
export const ANALYSIS_STALE_TIME_MS = 60_000

/** Keep unused day/employee snapshots around for revisit without refetch. */
export const ANALYSIS_GC_TIME_MS = 10 * 60_000

/** Employee directories change rarely during a session. */
export const ANALYSIS_EMPLOYEES_STALE_TIME_MS = 5 * 60_000

export const ANALYSIS_EMPLOYEES_GC_TIME_MS = 30 * 60_000

/**
 * Reportes Operativos source lists (tasks/crews/projects) — shared identity.
 * Kept aligned with operational day cache; providers may still own load today.
 */
export const ANALYSIS_REPORTES_STALE_TIME_MS = 60_000

export const ANALYSIS_QUERY_DEFAULTS = {
  staleTime: ANALYSIS_STALE_TIME_MS,
  gcTime: ANALYSIS_GC_TIME_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
  retry: 1,
} as const
