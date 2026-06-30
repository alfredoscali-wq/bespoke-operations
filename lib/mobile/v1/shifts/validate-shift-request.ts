import type {
  MobileShiftDeviceRequest,
  MobileShiftFinishRequest,
  MobileShiftStartRequest,
} from "@/lib/mobile/v1/shifts/types"
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

function readDeviceRequest(body: unknown): MobileShiftDeviceRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  return {
    deviceId: readRequiredString(record.deviceId, "deviceId"),
  }
}

function readLocation(body: Record<string, unknown>) {
  return {
    latitude: readRequiredNumber(body.latitude, "latitude"),
    longitude: readRequiredNumber(body.longitude, "longitude"),
  }
}

export function validateMobileShiftStartRequest(
  body: unknown
): MobileShiftStartRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>
  const device = readDeviceRequest(body)
  const location = readLocation(record)

  return {
    ...device,
    ...location,
  }
}

export function validateMobileShiftFinishRequest(
  body: unknown
): MobileShiftFinishRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>
  const device = readDeviceRequest(body)
  const location = readLocation(record)

  return {
    ...device,
    ...location,
  }
}

export function validateMobileShiftCurrentQuery(
  deviceId: string | null
): MobileShiftDeviceRequest {
  if (!deviceId?.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Parámetro requerido: deviceId.",
      400
    )
  }

  return { deviceId: deviceId.trim() }
}
