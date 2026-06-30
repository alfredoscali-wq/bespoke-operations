import { roundCoordinate } from "@/lib/gps/coordinates"

export function isValidCoordinatePair(
  latitude: number,
  longitude: number
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

export function normalizeCoordinates(
  latitude: number,
  longitude: number
): { latitude: number; longitude: number } | null {
  if (!isValidCoordinatePair(latitude, longitude)) {
    return null
  }

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  }
}

export function formatCoordinatePair(latitude: number, longitude: number): string {
  return `${roundCoordinate(latitude)},${roundCoordinate(longitude)}`
}
