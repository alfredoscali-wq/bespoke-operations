import {
  MOBILE_SUPPORTED_PLATFORMS,
  type MobilePlatform,
} from "@/lib/mobile/v1/constants"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileLoginRequest } from "@/lib/mobile/v1/auth/types"

function isMobilePlatform(value: string): value is MobilePlatform {
  return MOBILE_SUPPORTED_PLATFORMS.includes(value as MobilePlatform)
}

export function validateMobileLoginRequest(
  body: unknown
): MobileLoginRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  const record = body as Record<string, unknown>
  const email = typeof record.email === "string" ? record.email.trim() : ""
  const password = typeof record.password === "string" ? record.password : ""
  const deviceId =
    typeof record.deviceId === "string" ? record.deviceId.trim() : ""
  const appVersion =
    typeof record.appVersion === "string" ? record.appVersion.trim() : ""
  const platform =
    typeof record.platform === "string" ? record.platform.trim() : ""

  if (!email) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "email es obligatorio.",
      400
    )
  }

  if (!password) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "password es obligatorio.",
      400
    )
  }

  if (!deviceId) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "deviceId es obligatorio.",
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

  if (!isMobilePlatform(platform)) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "platform debe ser android.",
      400
    )
  }

  return {
    email,
    password,
    deviceId,
    appVersion,
    platform,
  }
}
