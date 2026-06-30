import { parseInlineCoordinates } from "@/lib/location/parse-inline-coordinates"
import {
  isAllowedGoogleMapsUrl,
  isGoogleMapsShortUrl,
  isGoogleMapsWebUrl,
} from "@/lib/location/providers/google/allowed-urls"

export function normalizeLocationInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (isGoogleMapsShortUrl(trimmed) || isGoogleMapsWebUrl(trimmed)) {
    return `https://${trimmed.replace(/^\/\//, "")}`
  }

  return trimmed
}

export function isValidLocationInput(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  if (parseInlineCoordinates(trimmed)) {
    return true
  }

  if (isGoogleMapsShortUrl(trimmed)) {
    return true
  }

  if (isGoogleMapsWebUrl(trimmed)) {
    return true
  }

  return isAllowedGoogleMapsUrl(trimmed)
}
