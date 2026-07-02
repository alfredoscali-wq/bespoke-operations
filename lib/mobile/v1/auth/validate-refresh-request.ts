import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileRefreshTokenRequest } from "@/lib/mobile/v1/auth/contracts"

export function validateMobileRefreshRequest(
  body: unknown
): MobileRefreshTokenRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  const record = body as Record<string, unknown>
  const refreshToken =
    typeof record.refreshToken === "string" ? record.refreshToken.trim() : ""
  const deviceId =
    typeof record.deviceId === "string" ? record.deviceId.trim() : ""

  if (!refreshToken) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "refreshToken es obligatorio.",
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

  return { refreshToken, deviceId }
}
