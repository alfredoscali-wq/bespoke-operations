import { parseInlineCoordinates } from "@/lib/location/parse-inline-coordinates"
import { resolveLocationViaApi } from "@/lib/location/client/resolve-via-api"
import type { CommercialLocationSource } from "@/lib/commercial/catalogs"
import { hasCoordinates } from "@/lib/gps"

export type CommercialResolvedCoords = {
  latitude: number
  longitude: number
  locationSource: CommercialLocationSource
}

export type CommercialLocationResolveResult =
  | { status: "resolved"; coords: CommercialResolvedCoords }
  | { status: "skipped" }
  | { status: "failed"; reason: "invalid_paste" }

/**
 * Resolve location at save time without free-text geocoding.
 * Address geocoding happens live via autocomplete while typing.
 */
export async function resolveCommercialLocationPaste(
  input: string
): Promise<CommercialResolvedCoords | null> {
  const trimmed = input.trim()
  if (!trimmed) return null

  const inline = parseInlineCoordinates(trimmed)
  if (inline) {
    return {
      latitude: inline.latitude,
      longitude: inline.longitude,
      locationSource: "manual",
    }
  }

  try {
    const resolved = await resolveLocationViaApi(trimmed)
    return {
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      locationSource: "manual",
    }
  } catch {
    return null
  }
}

export async function resolveCommercialPersonLocation(input: {
  locationInput?: string
  latitude?: number | null
  longitude?: number | null
  locationSource?: CommercialLocationSource | null
}): Promise<CommercialLocationResolveResult> {
  if (hasCoordinates(input.latitude, input.longitude)) {
    return {
      status: "resolved",
      coords: {
        latitude: input.latitude as number,
        longitude: input.longitude as number,
        locationSource: input.locationSource ?? "manual",
      },
    }
  }

  const paste = input.locationInput?.trim() ?? ""
  if (paste) {
    const fromPaste = await resolveCommercialLocationPaste(paste)
    if (fromPaste) {
      return { status: "resolved", coords: fromPaste }
    }
    return { status: "failed", reason: "invalid_paste" }
  }

  return { status: "skipped" }
}
