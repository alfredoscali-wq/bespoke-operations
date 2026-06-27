import {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_PRODUCTION_COMPANY_ID,
} from "@/lib/supabase/company.constants"

/** Strips non-digit characters from a national ID (DNI). */
export function normalizeDni(dni: string): string {
  return dni.replace(/\D/g, "").trim()
}

/**
 * Builds the Supabase Auth email for DNI-based login.
 * Supabase Auth requires email or phone; the DNI is the user-facing identifier.
 */
export function buildAuthEmail(
  dni: string,
  companyId: string = BESPOKE_PRODUCTION_COMPANY_ID
): string {
  const normalized = normalizeDni(dni)

  if (!normalized) {
    throw new Error("DNI inválido")
  }

  return `${normalized}.${companyId}@auth.bespoke.local`
}

/** Indica si el identificador ingresado en login es un correo electrónico. */
export function isEmailLoginIdentifier(identifier: string): boolean {
  return identifier.trim().includes("@")
}

/**
 * Emails Auth candidatos para login con DNI.
 * Incluye producción y demo: cuentas legacy pueden conservar el sufijo demo
 * aunque el empleado ya pertenezca a Bespoke Operations.
 */
export function buildAuthEmailCandidatesForDni(dni: string): string[] {
  const normalized = normalizeDni(dni)

  if (!normalized) {
    throw new Error("DNI inválido")
  }

  return [
    buildAuthEmail(normalized, BESPOKE_PRODUCTION_COMPANY_ID),
    buildAuthEmail(normalized, BESPOKE_DEMO_COMPANY_ID),
  ]
}

/**
 * Resuelve los emails Auth a intentar al iniciar sesión.
 * Correo → un solo candidato. DNI → candidatos por tenant (sin duplicar).
 */
export function resolveSignInEmailCandidates(identifier: string): string[] {
  const trimmed = identifier.trim()

  if (!trimmed) {
    throw new Error("Identificador inválido")
  }

  if (isEmailLoginIdentifier(trimmed)) {
    return [trimmed.toLowerCase()]
  }

  return buildAuthEmailCandidatesForDni(trimmed)
}

/** Primer candidato (compatibilidad con llamadas existentes). */
export function resolveLoginEmail(identifier: string): string {
  return resolveSignInEmailCandidates(identifier)[0]
}

/** Extracts the normalized DNI from a synthetic auth email, if present. */
export function parseDniFromAuthEmail(email: string): string | null {
  const match = email.match(/^([0-9]+)\./)
  return match?.[1] ?? null
}
