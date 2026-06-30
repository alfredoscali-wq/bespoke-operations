import "server-only"

import {
  getCachedResolution,
  setCachedResolution,
} from "@/lib/location/cache"
import { parseInlineCoordinates } from "@/lib/location/parse-inline-coordinates"
import {
  followGoogleMapsRedirects,
  parseResolvedLocationFromUrl,
} from "@/lib/location/providers/google/follow-redirect"
import {
  isAllowedGoogleMapsUrl,
  requiresRedirectResolution,
} from "@/lib/location/providers/google/allowed-urls"
import {
  isValidLocationInput,
  normalizeLocationInput,
} from "@/lib/location/validate-location-input"
import type { LocationResolveResult } from "@/lib/location/types"

export async function resolveLocation(
  sharedLocation: string
): Promise<LocationResolveResult> {
  const trimmed = sharedLocation.trim()
  if (!trimmed) {
    return {
      ok: false,
      code: "EMPTY_INPUT",
      message: "La ubicación compartida está vacía.",
    }
  }

  const cached = getCachedResolution(trimmed)
  if (cached) {
    return { ok: true, data: cached }
  }

  if (!isValidLocationInput(trimmed)) {
    return {
      ok: false,
      code: "INVALID_FORMAT",
      message: "El formato de ubicación no es válido.",
    }
  }

  const normalizedInput = normalizeLocationInput(trimmed)
  const directInline = parseInlineCoordinates(normalizedInput)
  if (directInline && !requiresRedirectResolution(normalizedInput)) {
    setCachedResolution(trimmed, directInline)
    return { ok: true, data: directInline }
  }

  if (
    !requiresRedirectResolution(normalizedInput) &&
    !isAllowedGoogleMapsUrl(normalizedInput)
  ) {
    return {
      ok: false,
      code: "DISALLOWED_URL",
      message: "La URL no pertenece a un dominio oficial de Google Maps.",
    }
  }

  try {
    const { finalUrl, usedRedirect } =
      await followGoogleMapsRedirects(normalizedInput)
    const resolved = parseResolvedLocationFromUrl(finalUrl, usedRedirect)

    if (!resolved) {
      return {
        ok: false,
        code: "COORDINATES_NOT_FOUND",
        message:
          "No se pudieron extraer coordenadas del enlace de Google Maps.",
      }
    }

    setCachedResolution(trimmed, resolved)
    return { ok: true, data: resolved }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "DISALLOWED_URL") {
        return {
          ok: false,
          code: "DISALLOWED_URL",
          message: "La URL no pertenece a un dominio oficial de Google Maps.",
        }
      }

      if (error.message === "REDIRECT_BLOCKED") {
        return {
          ok: false,
          code: "REDIRECT_BLOCKED",
          message: "Se bloqueó un redirect a un dominio no permitido.",
        }
      }
    }

    return {
      ok: false,
      code: "RESOLUTION_FAILED",
      message: "No se pudo resolver la ubicación compartida.",
    }
  }
}
