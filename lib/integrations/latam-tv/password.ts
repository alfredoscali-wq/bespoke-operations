/** Límites de la documentación de LATAM. No se agregan reglas extra. */
export const LATAM_PASSWORD_MIN = 4
export const LATAM_PASSWORD_MAX = 10

export function validateLatamTvPassword(password: string): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "La contraseña es obligatoria."
  }
  if (password.length < LATAM_PASSWORD_MIN || password.length > LATAM_PASSWORD_MAX) {
    return "La contraseña debe tener entre 4 y 10 caracteres."
  }
  return null
}

export function latamPasswordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation
}
