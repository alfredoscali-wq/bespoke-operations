import { buildGoogleMapsUrl, hasCoordinates } from "@/lib/gps"
import { formatCoordinatePair } from "@/lib/location/coordinates"

export function hasResolvedCoordinates(
  latitude?: number | null,
  longitude?: number | null
): boolean {
  return hasCoordinates(latitude, longitude)
}

export function getLocationDisplayText(
  sharedLocation?: string,
  latitude?: number | null,
  longitude?: number | null
): string | undefined {
  const trimmed = sharedLocation?.trim()
  if (trimmed) {
    return trimmed
  }

  if (hasResolvedCoordinates(latitude, longitude)) {
    return formatCoordinatePair(latitude as number, longitude as number)
  }

  return undefined
}

export function getLocationHref(
  sharedLocation?: string,
  latitude?: number | null,
  longitude?: number | null
): string | undefined {
  if (hasResolvedCoordinates(latitude, longitude)) {
    return buildGoogleMapsUrl(latitude as number, longitude as number)
  }

  const trimmed = sharedLocation?.trim()
  if (!trimmed) {
    return undefined
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed.replace(/^\/\//, "")}`
}
