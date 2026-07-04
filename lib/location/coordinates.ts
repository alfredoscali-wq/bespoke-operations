import {
  isValidCoordinatePair,
  roundCoordinate,
} from "@/lib/gps/coordinates"

export { isValidCoordinatePair }

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
