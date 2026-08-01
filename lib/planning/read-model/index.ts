/**
 * Planning Read Model — Sprint 19 / Bloque F.
 * Server/safe barrel: builder + cache (no React hooks).
 */

export { buildPlanningReadModel } from "@/lib/planning/read-model/builder"

export {
  buildPlanningReadCacheKey,
  clearPlanningReadCache,
  getCachedPlanningReadModel,
  getOrBuildPlanningReadModel,
  getPlanningReadCacheSize,
  setCachedPlanningReadModel,
} from "@/lib/planning/read-model/cache"

export {
  PLANNING_READ_GC_TIME_MS,
  PLANNING_READ_QUERY_DEFAULTS,
  PLANNING_READ_STALE_TIME_MS,
} from "@/lib/planning/read-model/defaults"

export { planningQueryKeys } from "@/lib/planning/read-model/keys"

export type {
  PlanningAgendaRead,
  PlanningDispatchMode,
  PlanningObraRead,
  PlanningReadBuilderInput,
  PlanningReadDayConfig,
  PlanningReadIncidents,
  PlanningReadMetrics,
  PlanningReadModel,
  PlanningReadTasks,
} from "@/lib/planning/read-model/types"
