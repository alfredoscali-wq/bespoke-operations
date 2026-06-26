export type ParsedSharedLocation = {
  latitude?: number
  longitude?: number
  isValid: boolean
}

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

function buildParsedLocation(
  latitude: number,
  longitude: number
): ParsedSharedLocation {
  if (!isValidCoordinatePair(latitude, longitude)) {
    return { isValid: false }
  }

  return { latitude, longitude, isValid: true }
}

function normalizeHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function isGoogleMapsUrl(value: string): boolean {
  return (
    /^(https?:\/\/)?(www\.)?(google\.(com|[a-z]{2}(\.[a-z]{2})?)\/maps|maps\.google\.com)/i.test(
      value
    ) || /\/maps(\/|@|\?)/i.test(value)
  )
}

function isGoogleMapsShortUrl(value: string): boolean {
  return /^(https?:\/\/)?(maps\.)?app\.goo\.gl\//i.test(value)
}

export function isGoogleMapsShortUrlValue(value: string): boolean {
  return isGoogleMapsShortUrl(value.trim())
}

export function isGoogleMapsUrlValue(value: string): boolean {
  return isGoogleMapsUrl(value.trim())
}

export function parseSharedLocation(input: string): ParsedSharedLocation {
  const trimmed = input.trim()
  if (!trimmed) return { isValid: false }

  const placeDataMatch = trimmed.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
  )
  if (placeDataMatch) {
    return buildParsedLocation(
      Number.parseFloat(placeDataMatch[1]),
      Number.parseFloat(placeDataMatch[2])
    )
  }

  const queryMatch = trimmed.match(
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i
  )
  if (queryMatch) {
    return buildParsedLocation(
      Number.parseFloat(queryMatch[1]),
      Number.parseFloat(queryMatch[2])
    )
  }

  const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (atMatch) {
    return buildParsedLocation(
      Number.parseFloat(atMatch[1]),
      Number.parseFloat(atMatch[2])
    )
  }

  const plainMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (plainMatch) {
    return buildParsedLocation(
      Number.parseFloat(plainMatch[1]),
      Number.parseFloat(plainMatch[2])
    )
  }

  return { isValid: false }
}

export function isRecognizedSharedLocation(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false

  if (parseSharedLocation(trimmed).isValid) return true
  if (isGoogleMapsUrl(trimmed)) return true
  if (isGoogleMapsShortUrl(trimmed)) return true

  return false
}

export function hasLoadedGps(
  sharedLocation?: string,
  latitude?: number | null,
  longitude?: number | null
): boolean {
  void sharedLocation

  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
}

export function getSharedLocationDisplayText(
  sharedLocation?: string,
  latitude?: number | null,
  longitude?: number | null
): string | undefined {
  const trimmed = sharedLocation?.trim()
  if (trimmed) return trimmed

  if (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return `${latitude},${longitude}`
  }

  return undefined
}

export function getSharedLocationHref(
  sharedLocation?: string,
  latitude?: number | null,
  longitude?: number | null
): string | undefined {
  const trimmed = sharedLocation?.trim() ?? ""

  if (trimmed) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (isGoogleMapsShortUrl(trimmed) || isGoogleMapsUrl(trimmed)) {
      return normalizeHref(trimmed)
    }

    const parsed = parseSharedLocation(trimmed)
    if (parsed.isValid && parsed.latitude != null && parsed.longitude != null) {
      return `https://www.google.com/maps?q=${parsed.latitude},${parsed.longitude}`
    }
  }

  if (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return `https://www.google.com/maps?q=${latitude},${longitude}`
  }

  return undefined
}
