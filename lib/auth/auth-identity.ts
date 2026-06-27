import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"

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

/** Resuelve el email de Auth a partir de DNI o correo ingresado en login. */
export function resolveLoginEmail(identifier: string): string {
  const trimmed = identifier.trim()

  if (!trimmed) {
    throw new Error("Identificador inválido")
  }

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase()
  }

  return buildAuthEmail(trimmed)
}

/** Extracts the normalized DNI from a synthetic auth email, if present. */
export function parseDniFromAuthEmail(email: string): string | null {
  const match = email.match(/^([0-9]+)\./)
  return match?.[1] ?? null
}
