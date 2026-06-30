import {
  GOOGLE_MAPS_ALLOWED_HOSTS,
  GOOGLE_MAPS_HOST_PATTERN,
} from "@/lib/location/constants"

function parseHostname(value: string): string | null {
  try {
    const url = value.includes("://") ? value : `https://${value}`
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isAllowedGoogleMapsHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (GOOGLE_MAPS_ALLOWED_HOSTS.has(normalized)) {
    return true
  }

  return GOOGLE_MAPS_HOST_PATTERN.test(normalized)
}

export function isAllowedGoogleMapsUrl(value: string): boolean {
  const hostname = parseHostname(value.trim())
  if (!hostname) {
    return false
  }

  return isAllowedGoogleMapsHostname(hostname)
}

export function isGoogleMapsShortUrl(value: string): boolean {
  return /^(https?:\/\/)?(maps\.)?app\.goo\.gl\//i.test(value.trim())
}

export function isGoogleMapsWebUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  if (isGoogleMapsShortUrl(trimmed)) {
    return true
  }

  const hostname = parseHostname(trimmed)
  if (!hostname || !isAllowedGoogleMapsHostname(hostname)) {
    return false
  }

  return /\/maps(\/|@|\?)/i.test(trimmed) || /[?&](?:q|query|ll)=/i.test(trimmed)
}

export function requiresRedirectResolution(value: string): boolean {
  return isGoogleMapsShortUrl(value.trim())
}
