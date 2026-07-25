/**
 * OPS 2.3A / 2.3B — Planning Engine (route + capacity + summary + validation).
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
  MISSING_BASE_GPS_WARNING,
} from "@/lib/engines/planning/services/recalculate-journey-travel"

export { recalculateCrewJourneyTravel } from "@/lib/engines/planning/services/recalculate-crew-journey"

export type {
  CrewCapacity,
  CrewCapacityStatus,
  CrewPlanningSummary,
  PlanningWarning,
  PlanningWarningCode,
  PlanningWarningSeverity,
} from "@/lib/engines/planning/contracts/CrewPlanningSummary"

export {
  CapacityService,
  capacityService,
  calculateCrewCapacity,
  isCrewBaseGpsAvailable,
} from "@/lib/engines/planning/services/CapacityService"

export {
  ValidationService,
  validationService,
  validateCrewPlanning,
} from "@/lib/engines/planning/services/ValidationService"

export {
  SummaryService,
  summaryService,
  buildCrewPlanningSummary,
  formatTravelDistanceKm,
} from "@/lib/engines/planning/services/SummaryService"
