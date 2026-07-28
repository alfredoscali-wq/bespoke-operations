export const PRESENCE_EVENT_TYPES = [
  "ENTER_RADIUS",
  "HEARTBEAT",
  "EXIT_RADIUS",
] as const

export type PresenceEventType = (typeof PRESENCE_EVENT_TYPES)[number]

export const PRESENCE_LOCATION_PROVIDERS = [
  "GPS",
  "NETWORK",
  "FUSED",
] as const

export type PresenceLocationProvider =
  (typeof PRESENCE_LOCATION_PROVIDERS)[number]

/**
 * Default operational geofence radius (meters).
 * Server authority — do not hardcode this value elsewhere.
 * Per-company overrides live in `presence_engine_settings`.
 */
export const DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS = 150

/**
 * Near-duplicate window. Short enough that normal HEARTBEAT cadence
 * (tens of seconds) is never blocked; long enough to absorb double-posts.
 */
export const PRESENCE_EVENT_IDEMPOTENCY_WINDOW_MS = 2_000

export function isPresenceEventType(value: string): value is PresenceEventType {
  return (PRESENCE_EVENT_TYPES as readonly string[]).includes(value)
}

export function isPresenceLocationProvider(
  value: string
): value is PresenceLocationProvider {
  return (PRESENCE_LOCATION_PROVIDERS as readonly string[]).includes(value)
}
