import { MOBILE_SUPPORTED_PLATFORMS } from "@/lib/mobile/v1/constants"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileProvisionDeviceRequest } from "@/lib/mobile/v1/devices/types"

export function validateMobileProvisionDeviceRequest(
  body: unknown
): MobileProvisionDeviceRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  const record = body as Record<string, unknown>
  const deviceId =
    typeof record.deviceId === "string" ? record.deviceId.trim() : ""
  const manufacturer =
    typeof record.manufacturer === "string" ? record.manufacturer.trim() : ""
  const model = typeof record.model === "string" ? record.model.trim() : ""
  const androidVersion =
    typeof record.androidVersion === "string"
      ? record.androidVersion.trim()
      : ""
  const appVersion =
    typeof record.appVersion === "string" ? record.appVersion.trim() : ""
  const platform =
    typeof record.platform === "string" ? record.platform.trim() : ""

  if (!deviceId) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "deviceId es obligatorio.",
      400
    )
  }

  if (!manufacturer) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "manufacturer es obligatorio.",
      400
    )
  }

  if (!model) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "model es obligatorio.",
      400
    )
  }

  if (!androidVersion) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "androidVersion es obligatorio.",
      400
    )
  }

  if (!appVersion) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "appVersion es obligatorio.",
      400
    )
  }

  if (!MOBILE_SUPPORTED_PLATFORMS.includes(platform as "android")) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "platform debe ser android.",
      400
    )
  }

  return {
    deviceId,
    manufacturer,
    model,
    androidVersion,
    appVersion,
    platform: "android",
  }
}
