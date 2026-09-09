/**
 * Política de credenciales iniciales (empleados internos y usuarios Field Agent externos).
 *
 * - Identificador de login (usuario): DNI (solo dígitos en Auth).
 * - Contraseña inicial en provisioning: generateTemporaryPassword() (Sprint 7.5.2B).
 * - Reset de contraseña: todavía DNI (Sprint 7.5.2C).
 * - Tras provisionar o restablecer: must_change_password = true.
 *
 * Portal web: PasswordChangeGuard obliga el cambio en el primer inicio.
 * Field Agent (móvil): preparado vía metadata/DB; enforcement en app móvil = mejora futura.
 */

import { normalizeDni } from "@/lib/auth/auth-identity"

export const INITIAL_CREDENTIALS_POLICY = {
  loginIdentifier: "DNI",
  initialPassword: "temporary",
  requireChangeOnFirstLogin: true,
} as const

export function resolveInitialPasswordFromDni(dni: string): string | null {
  const normalized = normalizeDni(dni)
  return normalized || null
}

/** Texto corto para formularios de alta. */
export function buildInitialCredentialsInfoMessage(dniPreview?: string): string {
  const dniLabel = dniPreview?.trim()
    ? ` (${normalizeDni(dniPreview) || dniPreview.trim()})`
    : ""

  return `Credenciales iniciales: usuario = DNI${dniLabel}. Se generará una contraseña temporal al crear el acceso. El usuario deberá cambiarla en el primer inicio de sesión.`
}

/** Texto para diálogo de restablecimiento. */
export function buildResetPasswordToDniDescription(dni: string | null | undefined): string {
  const display = dni?.trim() || "—"
  return `La contraseña temporal será el DNI (${display}). El usuario deberá cambiarla al iniciar sesión.`
}

/** Feedback tras alta/provisión exitosa. */
export function buildProvisionedCredentialsFeedback(displayName: string): string {
  return `${displayName}: acceso creado. Entregue la contraseña temporal al usuario. Deberá cambiarla en el primer inicio.`
}

export function buildTemporaryPasswordDeliveryMessage(
  displayName?: string
): string {
  const who = displayName?.trim()
    ? ` al empleado (${displayName.trim()})`
    : " al empleado"
  return `Esta contraseña es temporal. Entréguesela${who} ahora; no se volverá a mostrar. Deberá cambiarla en el primer acceso.`
}

/** Feedback tras restablecer. */
export function buildPasswordResetToDniFeedback(displayName: string): string {
  return `Contraseña de ${displayName} restablecida al DNI. Deberá cambiarla en el próximo inicio.`
}
