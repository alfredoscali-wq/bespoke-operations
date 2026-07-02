import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileTaskStartRequest } from "@/lib/mobile/v1/tasks/types"

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

function readOptionalNumber(value: unknown, field: string): number | null {
  if (value == null) {
    return null
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Campo numérico inválido: ${field}.`,
      400
    )
  }

  return value
}

export function validateMobileTaskStartRequest(body: unknown): MobileTaskStartRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  return {
    deviceId: readRequiredString(record.deviceId, "deviceId"),
    latitude: readRequiredNumber(record.latitude, "latitude"),
    longitude: readRequiredNumber(record.longitude, "longitude"),
    accuracyMeters: readOptionalNumber(record.accuracyMeters, "accuracyMeters"),
  }
}
