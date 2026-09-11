export const WEB_CHANGE_PASSWORD_MIN_LENGTH = 8

export function parseWebChangePasswordRequest(body: unknown): {
  newPassword: string
} | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Cuerpo JSON inválido." }
  }

  const record = body as Record<string, unknown>
  const newPassword =
    typeof record.newPassword === "string" ? record.newPassword : ""

  if (!newPassword) {
    return { error: "newPassword es obligatorio." }
  }

  if (newPassword.length < WEB_CHANGE_PASSWORD_MIN_LENGTH) {
    return { error: "La contraseña debe tener al menos 8 caracteres." }
  }

  return { newPassword }
}
