import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileChangePasswordRequest } from "@/lib/mobile/v1/auth/contracts"

/** Same minimum as the web change-password form. */
export const MOBILE_CHANGE_PASSWORD_MIN_LENGTH = 8

export function validateMobileChangePasswordRequest(
  body: unknown
): MobileChangePasswordRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  const record = body as Record<string, unknown>
  const newPassword =
    typeof record.newPassword === "string" ? record.newPassword : ""

  if (!newPassword) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "newPassword es obligatorio.",
      400
    )
  }

  if (newPassword.length < MOBILE_CHANGE_PASSWORD_MIN_LENGTH) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "La contraseña debe tener al menos 8 caracteres.",
      400
    )
  }

  return { newPassword }
}
