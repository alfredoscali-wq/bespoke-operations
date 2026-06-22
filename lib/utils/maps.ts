export function hasValidCoordinates(
  latitude?: number | null,
  longitude?: number | null
): latitude is number {
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
}

export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

export function formatCoordinate(value: number): string {
  return value.toFixed(6)
}
