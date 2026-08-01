/**
 * React Query keys for Planning Read Model (Sprint 19).
 * Uses the existing Analysis QueryClient — no new providers.
 */

export const planningQueryKeys = {
  root: ["planning"] as const,

  readModel: (cacheKey: string) =>
    ["planning", "read-model", cacheKey] as const,
} as const
