import type {
  RouteCoordinate,
  RouteRequest,
  RouteResult,
} from "@/lib/engines/planning/contracts/RouteRequest"

/**
 * Map provider abstraction — the rest of the system must not know ORS.
 */
export type RouteProvider = {
  readonly name: RouteResult["provider"]
  getRoute(request: RouteRequest): Promise<RouteResult>
}

export function isValidRouteCoordinate(
  coordinate: RouteCoordinate | null | undefined
): coordinate is RouteCoordinate {
  if (!coordinate) {
    return false
  }
  const { latitude, longitude } = coordinate
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}
