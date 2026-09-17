import { hasCoordinates } from "@/lib/gps"
import {
  GPS_ACCURACY_MAX_METERS,
  GPS_HEARTBEAT_TIMESTAMP_MAX_FUTURE_MS,
  GPS_HEARTBEAT_TIMESTAMP_MAX_PAST_MS,
} from "@/lib/gps-live/constants"
import type { GpsLiveHeartbeatRequest } from "@/lib/gps-live/types"
import { MobileApiError } from "@/lib/mobile/v1/errors"

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Campo requerido: ${field}.`,
      400
    )
  }
  return value.trim()
}

function readRequiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Campo numérico inválido: ${field}.`,
      400
    )
  }
  return value
}

function readOptionalAccuracy(value: unknown): number | null {
  if (value == null) {
    return null
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Campo numérico inválido: accuracyMeters.",
      400
    )
  }
  if (value < 0 || value > GPS_ACCURACY_MAX_METERS) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "accuracyMeters fuera de rango.",
      400
    )
  }
  return value
}

function readTimestamp(value: unknown, nowMs: number): string {
  const raw = readRequiredString(value, "timestamp")
  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Campo timestamp inválido.",
      400
    )
  }
  if (parsed - nowMs > GPS_HEARTBEAT_TIMESTAMP_MAX_FUTURE_MS) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Campo timestamp inválido.",
      400
    )
  }
  if (nowMs - parsed > GPS_HEARTBEAT_TIMESTAMP_MAX_PAST_MS) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Campo timestamp inválido.",
      400
    )
  }
  return new Date(parsed).toISOString()
}

export function validateMobileGpsHeartbeatRequest(
  body: unknown,
  nowMs: number = Date.now()
): GpsLiveHeartbeatRequest {
  // companyId and workTeamId in the body are ignored. Tenant and crew
  // come from the authenticated session and the device association.
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>
  const latitude = readRequiredNumber(record.latitude, "latitude")
  const longitude = readRequiredNumber(record.longitude, "longitude")

  if (!hasCoordinates(latitude, longitude)) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Coordenadas GPS inválidas.",
      400
    )
  }

  return {
    deviceId: readRequiredString(record.deviceId, "deviceId"),
    latitude,
    longitude,
    accuracyMeters: readOptionalAccuracy(record.accuracyMeters),
    timestamp: readTimestamp(record.timestamp, nowMs),
  }
}
