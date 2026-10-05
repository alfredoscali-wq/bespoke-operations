import { MOBILE_SUPPORTED_PLATFORMS } from "@/lib/mobile/v1/constants"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobilePushTokenRequest } from "@/lib/mobile/v1/push/types"

export function validateMobilePushTokenRequest(
  body: unknown
): MobilePushTokenRequest {
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
  const pushToken =
    typeof record.pushToken === "string" ? record.pushToken.trim() : ""
  const platform =
    typeof record.platform === "string" ? record.platform.trim() : ""

  if (!deviceId) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "deviceId es obligatorio.",
      400
    )
  }

  if (!pushToken) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "pushToken es obligatorio.",
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
    pushToken,
    platform: "android",
  }
}
