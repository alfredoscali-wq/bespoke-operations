import {
  formatCoordinatePair,
  isValidCoordinatePair,
  normalizeCoordinates,
} from "@/lib/location/coordinates"
import type { ResolvedLocation } from "@/lib/location/types"

function buildInlineResult(
  latitude: number,
  longitude: number,
  normalizedLocation: string
): ResolvedLocation | null {
  const normalized = normalizeCoordinates(latitude, longitude)
  if (!normalized) {
    return null
  }

  return {
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    normalizedLocation,
    resolutionMethod: "inline",
  }
}

function decodeLocationCandidate(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseCoordinatePairFromMatch(
  latitudeRaw: string,
  longitudeRaw: string,
  normalizedLocation: string
): ResolvedLocation | null {
  const latitude = Number.parseFloat(latitudeRaw)
  const longitude = Number.parseFloat(longitudeRaw.replace(/^\+/, ""))

  return buildInlineResult(latitude, longitude, normalizedLocation)
}

function parseGoogleMapsSearchPath(input: string): ResolvedLocation | null {
  const candidates = [input, decodeLocationCandidate(input)]

  for (const candidate of candidates) {
    const searchPathMatch = candidate.match(
      /\/maps\/search\/(-?\d+(?:\.\d+)?)\s*,\s*\+?(-?\d+(?:\.\d+)?)/i
    )
    if (searchPathMatch) {
      return parseCoordinatePairFromMatch(
        searchPathMatch[1],
        searchPathMatch[2],
        input.trim()
      )
    }
  }

  return null
}

export function parseInlineCoordinates(input: string): ResolvedLocation | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const searchPathResult = parseGoogleMapsSearchPath(trimmed)
  if (searchPathResult) {
    return searchPathResult
  }

  const placeDataMatch = trimmed.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
  )
  if (placeDataMatch) {
    return buildInlineResult(
      Number.parseFloat(placeDataMatch[1]),
      Number.parseFloat(placeDataMatch[2]),
      trimmed
    )
  }

  const queryMatch = trimmed.match(
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i
  )
  if (queryMatch) {
    const latitude = Number.parseFloat(queryMatch[1])
    const longitude = Number.parseFloat(queryMatch[2])
    return parseCoordinatePairFromMatch(
      queryMatch[1],
      queryMatch[2],
      formatCoordinatePair(latitude, longitude)
    )
  }

  const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (atMatch) {
    return parseCoordinatePairFromMatch(
      atMatch[1],
      atMatch[2],
      formatCoordinatePair(
        Number.parseFloat(atMatch[1]),
        Number.parseFloat(atMatch[2])
      )
    )
  }

  const plainMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (plainMatch) {
    return parseCoordinatePairFromMatch(
      plainMatch[1],
      plainMatch[2],
      formatCoordinatePair(
        Number.parseFloat(plainMatch[1]),
        Number.parseFloat(plainMatch[2])
      )
    )
  }

  const dmsPlainMatch = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/
  )
  if (dmsPlainMatch) {
    const latitude = Number.parseFloat(dmsPlainMatch[1])
    const longitude = Number.parseFloat(dmsPlainMatch[2])
    if (isValidCoordinatePair(latitude, longitude)) {
      return buildInlineResult(
        latitude,
        longitude,
        formatCoordinatePair(latitude, longitude)
      )
    }
  }

  return null
}
