/** GPS Live 1.0 — last crew position. Interval matches company_mobile_settings. */

export const GPS_HEARTBEAT_INTERVAL_MIN_SECONDS = 30
export const GPS_HEARTBEAT_INTERVAL_MAX_SECONDS = 120
export const DEFAULT_GPS_HEARTBEAT_ENABLED = true
export const DEFAULT_GPS_HEARTBEAT_INTERVAL_SECONDS = 60

/**
 * Server floor between accepted heartbeats.
 * Below the 30 s tenant minimum so legitimate 30 s pings are never rejected.
 */
export const GPS_HEARTBEAT_MIN_ACCEPT_GAP_SECONDS = 20

/** Map poll interval (Operations). Not Realtime. */
export const GPS_LIVE_MAP_POLL_MS = 30_000

/** Stale if received_at or captured_at older than this many tenant intervals. */
export const GPS_LIVE_STALE_INTERVAL_MULTIPLIER = 3

export const GPS_HEARTBEAT_TIMESTAMP_MAX_FUTURE_MS = 2 * 60 * 1000
export const GPS_HEARTBEAT_TIMESTAMP_MAX_PAST_MS = 24 * 60 * 60 * 1000

export const GPS_ACCURACY_MAX_METERS = 10_000
