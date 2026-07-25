/**
 * OPS 2.3A — route engine contracts.
 */

export type RouteCoordinate = {
  latitude: number
  longitude: number
}

export type RouteRequest = {
  origin: RouteCoordinate
  destination: RouteCoordinate
  /** Optional correlation id for logs. */
  requestId?: string
}

export type RouteProviderName = "openrouteservice"

export type RouteResultStatus =
  | "ok"
  | "error"
  | "timeout"
  | "rate_limited"
  | "invalid_coordinates"
  | "unavailable"

export type RouteResult = {
  minutes: number
  distanceMeters: number
  provider: RouteProviderName
  status: RouteResultStatus
  /** True when value came from MemoryRouteCache. */
  cacheHit: boolean
  /** Provider round-trip ms (0 on cache hit). */
  responseTimeMs: number
  message?: string
}

export type TravelSource = "AUTOMATIC" | "MANUAL"

export type RouteSegmentKind = "to_task" | "return_to_base"

/**
 * Logical journey segment for planning recalculation.
 * Persistence stays on task_metadata (OPS 2.1/2.2).
 */
export type RouteSegment = {
  id: string
  kind: RouteSegmentKind
  /** Task that owns the metadata for this leg. */
  ownerTaskId: string
  origin: RouteCoordinate
  destination: RouteCoordinate
  originLabel: string
  destinationLabel: string
}
