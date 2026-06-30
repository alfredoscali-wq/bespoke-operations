export type {
  LocationInputValidation,
  LocationResolutionMethod,
  LocationResolveErrorCode,
  LocationResolveResult,
  ResolvedLocation,
} from "@/lib/location/types"

export {
  formatCoordinatePair,
  isValidCoordinatePair,
  normalizeCoordinates,
} from "@/lib/location/coordinates"

export { parseInlineCoordinates } from "@/lib/location/parse-inline-coordinates"

export {
  getLocationInputFeedback,
  validateLocationInput,
} from "@/lib/location/location-input-feedback"

export {
  isValidLocationInput,
  normalizeLocationInput,
} from "@/lib/location/validate-location-input"

export {
  getLocationDisplayText,
  getLocationHref,
  hasResolvedCoordinates,
} from "@/lib/location/display"

export {
  isGoogleMapsShortUrl,
  isGoogleMapsWebUrl,
  requiresRedirectResolution,
} from "@/lib/location/providers/google/allowed-urls"

export {
  clearResolutionCache,
  getCachedResolution,
  getResolutionCacheSize,
  setCachedResolution,
} from "@/lib/location/cache"
