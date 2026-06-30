export type LocationResolutionMethod = "inline" | "redirect"

export type ResolvedLocation = {
  latitude: number
  longitude: number
  normalizedLocation: string
  resolutionMethod: LocationResolutionMethod
}

export type LocationInputValidation = {
  valid: boolean
  reason?: "empty" | "invalid-format"
}

export type LocationResolveErrorCode =
  | "EMPTY_INPUT"
  | "INVALID_FORMAT"
  | "DISALLOWED_URL"
  | "REDIRECT_BLOCKED"
  | "COORDINATES_NOT_FOUND"
  | "RESOLUTION_FAILED"

export type LocationResolveResult =
  | { ok: true; data: ResolvedLocation }
  | { ok: false; code: LocationResolveErrorCode; message: string }
