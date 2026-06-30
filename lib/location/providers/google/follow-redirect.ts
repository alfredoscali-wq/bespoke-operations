import "server-only"

import {
  LOCATION_RESOLVE_USER_AGENT,
  MAX_LOCATION_REDIRECT_HOPS,
} from "@/lib/location/constants"
import { parseInlineCoordinates } from "@/lib/location/parse-inline-coordinates"
import {
  isAllowedGoogleMapsUrl,
  requiresRedirectResolution,
} from "@/lib/location/providers/google/allowed-urls"
import { normalizeLocationInput } from "@/lib/location/validate-location-input"
import type { ResolvedLocation } from "@/lib/location/types"

function resolveRedirectUrl(currentUrl: string, locationHeader: string): string {
  try {
    return new URL(locationHeader, currentUrl).toString()
  } catch {
    return locationHeader
  }
}

export async function followGoogleMapsRedirects(
  inputUrl: string
): Promise<{ finalUrl: string; usedRedirect: boolean }> {
  let currentUrl = normalizeLocationInput(inputUrl)
  let usedRedirect = false

  if (!isAllowedGoogleMapsUrl(currentUrl)) {
    throw new Error("DISALLOWED_URL")
  }

  if (!requiresRedirectResolution(currentUrl)) {
    const inline = parseInlineCoordinates(currentUrl)
    if (inline) {
      return { finalUrl: currentUrl, usedRedirect: false }
    }
  }

  for (let hop = 0; hop < MAX_LOCATION_REDIRECT_HOPS; hop += 1) {
    const inline = parseInlineCoordinates(currentUrl)
    if (inline) {
      return { finalUrl: currentUrl, usedRedirect }
    }

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": LOCATION_RESOLVE_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    })

    if (response.status >= 300 && response.status < 400) {
      const locationHeader = response.headers.get("location")
      if (!locationHeader) {
        break
      }

      const nextUrl = resolveRedirectUrl(currentUrl, locationHeader)
      if (!isAllowedGoogleMapsUrl(nextUrl)) {
        throw new Error("REDIRECT_BLOCKED")
      }

      currentUrl = nextUrl
      usedRedirect = true
      continue
    }

    break
  }

  return { finalUrl: currentUrl, usedRedirect }
}

export function parseResolvedLocationFromUrl(
  finalUrl: string,
  usedRedirect: boolean
): ResolvedLocation | null {
  const inline = parseInlineCoordinates(finalUrl)
  if (!inline) {
    return null
  }

  return {
    ...inline,
    normalizedLocation: finalUrl.trim(),
    resolutionMethod: usedRedirect ? "redirect" : "inline",
  }
}
