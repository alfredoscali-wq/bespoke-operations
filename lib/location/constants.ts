/** Official Google Maps hostnames allowed for location input and redirect following. */
export const GOOGLE_MAPS_ALLOWED_HOSTS = new Set([
  "maps.app.goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "www.maps.google.com",
  "m.google.com",
])

/** Regional Google Maps hosts, e.g. google.com.ar, google.co.uk */
export const GOOGLE_MAPS_HOST_PATTERN =
  /^(?:www\.)?google\.(?:com|[a-z]{2}(?:\.[a-z]{2})?)$/i

export const MAX_LOCATION_REDIRECT_HOPS = 5

export const LOCATION_RESOLVE_USER_AGENT =
  "BespokeOperations/1.0 (+https://bespoke.operations)"
