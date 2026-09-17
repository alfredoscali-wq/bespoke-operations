import {
  DEFAULT_GPS_HEARTBEAT_ENABLED,
  DEFAULT_GPS_HEARTBEAT_INTERVAL_SECONDS,
  GPS_HEARTBEAT_INTERVAL_MAX_SECONDS,
  GPS_HEARTBEAT_INTERVAL_MIN_SECONDS,
  GPS_HEARTBEAT_MIN_ACCEPT_GAP_SECONDS,
  GPS_LIVE_STALE_INTERVAL_MULTIPLIER,
} from "@/lib/gps-live/constants"
import type {
  CompanyGpsHeartbeatSettings,
  GpsLiveFreshness,
} from "@/lib/gps-live/types"

export function clampGpsHeartbeatIntervalSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_GPS_HEARTBEAT_INTERVAL_SECONDS
  }
  return Math.min(
    GPS_HEARTBEAT_INTERVAL_MAX_SECONDS,
    Math.max(GPS_HEARTBEAT_INTERVAL_MIN_SECONDS, Math.round(value))
  )
}

export function mapCompanyGpsHeartbeatSettings(
  row: {
    gps_heartbeat_enabled: boolean
    gps_heartbeat_interval_seconds: number
  } | null
): CompanyGpsHeartbeatSettings {
  if (!row) {
    return {
      gpsHeartbeatEnabled: DEFAULT_GPS_HEARTBEAT_ENABLED,
      gpsHeartbeatIntervalSeconds: DEFAULT_GPS_HEARTBEAT_INTERVAL_SECONDS,
    }
  }

  return {
    gpsHeartbeatEnabled: Boolean(row.gps_heartbeat_enabled),
    gpsHeartbeatIntervalSeconds: clampGpsHeartbeatIntervalSeconds(
      row.gps_heartbeat_interval_seconds
    ),
  }
}

export type GpsLiveHeartbeatRejectReason =
  | "device_not_found"
  | "device_blocked"
  | "work_team_not_assigned"
  | "disabled"
  | "shift_inactive"
  | "too_frequent"

export type GpsLiveHeartbeatGateResult =
  | { accept: true; workTeamId: string }
  | { accept: false; reason: GpsLiveHeartbeatRejectReason }

export function evaluateGpsLiveHeartbeatGate(input: {
  authCompanyId: string
  device: {
    companyId: string
    status: string
    workTeamId: string | null
  } | null
  shiftActive: boolean
  heartbeatEnabled: boolean
  lastReceivedAt: string | null
  nowMs: number
}): GpsLiveHeartbeatGateResult {
  if (!input.device || input.device.companyId !== input.authCompanyId) {
    return { accept: false, reason: "device_not_found" }
  }
  if (input.device.status !== "ACTIVE") {
    return { accept: false, reason: "device_blocked" }
  }
  if (!input.device.workTeamId) {
    return { accept: false, reason: "work_team_not_assigned" }
  }

  const decision = shouldAcceptGpsHeartbeat({
    heartbeatEnabled: input.heartbeatEnabled,
    shiftActive: input.shiftActive,
    lastReceivedAt: input.lastReceivedAt,
    nowMs: input.nowMs,
  })
  if (!decision.accept) {
    return decision
  }

  return { accept: true, workTeamId: input.device.workTeamId }
}

export function shouldAcceptGpsHeartbeat(input: {
  heartbeatEnabled: boolean
  shiftActive: boolean
  lastReceivedAt: string | null
  nowMs: number
}): { accept: true } | { accept: false; reason: "disabled" | "shift_inactive" | "too_frequent" } {
  if (!input.shiftActive) {
    return { accept: false, reason: "shift_inactive" }
  }
  if (!input.heartbeatEnabled) {
    return { accept: false, reason: "disabled" }
  }
  if (input.lastReceivedAt) {
    const lastMs = Date.parse(input.lastReceivedAt)
    if (
      Number.isFinite(lastMs) &&
      input.nowMs - lastMs < GPS_HEARTBEAT_MIN_ACCEPT_GAP_SECONDS * 1000
    ) {
      return { accept: false, reason: "too_frequent" }
    }
  }
  return { accept: true }
}

export function resolveGpsLiveFreshness(input: {
  capturedAt: string | null
  receivedAt: string | null
  intervalSeconds: number
  nowMs: number
}): GpsLiveFreshness {
  if (!input.capturedAt || !input.receivedAt) {
    return "missing"
  }

  const capturedMs = Date.parse(input.capturedAt)
  const receivedMs = Date.parse(input.receivedAt)
  if (!Number.isFinite(capturedMs) || !Number.isFinite(receivedMs)) {
    return "stale"
  }

  const interval = clampGpsHeartbeatIntervalSeconds(input.intervalSeconds)
  const maxAgeMs = interval * GPS_LIVE_STALE_INTERVAL_MULTIPLIER * 1000
  const capturedAge = input.nowMs - capturedMs
  const receivedAge = input.nowMs - receivedMs

  if (capturedAge > maxAgeMs || receivedAge > maxAgeMs) {
    return "stale"
  }

  return "recent"
}

export function upsertGpsLiveLocationRow(input: {
  existing: { companyId: string; workTeamId: string } | null
  companyId: string
  workTeamId: string
  deviceId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  capturedAt: string
  receivedAt: string
}): {
  companyId: string
  workTeamId: string
  deviceId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  capturedAt: string
  receivedAt: string
  created: boolean
} {
  return {
    companyId: input.companyId,
    workTeamId: input.workTeamId,
    deviceId: input.deviceId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    capturedAt: input.capturedAt,
    receivedAt: input.receivedAt,
    created: input.existing == null,
  }
}
