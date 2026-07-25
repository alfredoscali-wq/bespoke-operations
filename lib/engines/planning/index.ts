/**
 * OPS 2.3A — Planning Engine (route foundation).
 * Capacity / Summary / Validation services land in later sprints.
 */

export type {
  RouteCoordinate,
  RouteRequest,
  RouteResult,
  RouteResultStatus,
  RouteSegment,
  RouteSegmentKind,
  TravelSource,
} from "@/lib/engines/planning/contracts/RouteRequest"

export type { RouteProvider } from "@/lib/engines/planning/providers/RouteProvider"
export { isValidRouteCoordinate } from "@/lib/engines/planning/providers/RouteProvider"
export { OpenRouteServiceProvider } from "@/lib/engines/planning/providers/OpenRouteServiceProvider"

export {
  MemoryRouteCache,
  sharedMemoryRouteCache,
  buildRouteCacheKey,
} from "@/lib/engines/planning/cache/MemoryRouteCache"

export {
  RouteService,
  getSharedRouteService,
  resetSharedRouteServiceForTests,
} from "@/lib/engines/planning/services/RouteService"

export {
  PlanningRepository,
  planningRepository,
  buildTravelEndpointsKey,
} from "@/lib/engines/planning/repositories/PlanningRepository"

export {
  buildCrewJourneySegments,
  listAffectedSegmentIds,
} from "@/lib/engines/planning/services/recalculate-journey-travel"

export { recalculateCrewJourneyTravel } from "@/lib/engines/planning/services/recalculate-crew-journey"
