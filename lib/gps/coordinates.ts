import type { GpsCoordinates } from "@/lib/gps/types"

function isValidCoordinatePair(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 10_000_000) / 10_000_000
}

export function hasCoordinates(
  latitude?: number | null,
  longitude?: number | null
): boolean {
  return (
    latitude != null &&
    longitude != null &&
    isValidCoordinatePair(latitude, longitude)
  )
}

export function resolveCoordinates(
  latitude?: number | null,
  longitude?: number | null
): GpsCoordinates | null {
  if (!hasCoordinates(latitude, longitude)) {
    return null
  }

  return {
    latitude: latitude as number,
    longitude: longitude as number,
  }
}

export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

export function buildGoogleMapsNavigationUrl(
  latitude: number,
  longitude: number
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

export function formatCoordinate(value: number): string {
  return roundCoordinate(value).toFixed(7)
}

export function toGpsCoordinates(
  latitude: number,
  longitude: number
): GpsCoordinates {
  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  }
}
