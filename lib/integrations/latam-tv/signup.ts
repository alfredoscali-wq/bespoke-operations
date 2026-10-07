import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import type { LatamTvPlanDiagnosis } from "@/lib/integrations/latam-tv/plans"

/**
 * Alta LATAM TV.
 *
 * Regla definitiva de acceso:
 * - El usuario de LATAM es el email del cliente (`correo`).
 * - La contraseña inicial es el DNI del cliente, solo dígitos.
 * - No se genera una contraseña aleatoria, no se pide al operador
 *   y no se usa el email como contraseña.
 * - `identificador` es el N° ABNet ya cargado en Bespoke.
 * - `plan` es el pl_id que get-plans asocia por nombre a TV Básica o
 *   TV Básica + Pack Fútbol. TV Full no se usa en el alta.
 *   Si no hay correspondencia, no se inventa un id.
 * - No se envían dispositivos ni fecha de nacimiento en este alta.
 */

export const LATAM_SIGNUP_MISSING = {
  identifier: "N° ABNet",
  name: "Nombre",
  nationalId: "DNI",
  email: "Email",
  plan: "Falta configurar la correspondencia del plan LATAM.",
  tvPlan: "Plan de TV",
} as const

export const LATAM_FULL_SIGNUP_BLOCKED =
  "TV Full no está operativo para el alta en LATAM."

const PLAN_LABEL = {
  basica: "TV Básica",
  pack: "TV Básica + Pack Fútbol",
  full: "TV Full",
} as const

export type LatamSignupTvKind = "basica" | "pack" | "full" | "other"

export function isLatamSignupTvKind(value: unknown): value is LatamSignupTvKind {
  return value === "basica" || value === "pack" || value === "full" || value === "other"
}

/**
 * Id operativo para el alta. Sin catálogo de get-plans devuelve null:
 * no se inventa un pl_id. TV Full queda identificado en el diagnóstico
 * y no se usa para altas ni para el cambio futuro.
 */
export function latamPlanIdForTvKind(
  tvKind: LatamSignupTvKind,
  diagnosis?: LatamTvPlanDiagnosis | null
): string | null {
  if (!diagnosis) return null
  if (tvKind !== "basica" && tvKind !== "pack") return null
  const row = diagnosis.correspondence.find((item) => item.bespokeKind === tvKind)
  if (!row || row.status !== "ok" || !row.planId) return null
  return row.planId
}

export function latamSignupPlanGap(
  tvKind: LatamSignupTvKind,
  diagnosis?: LatamTvPlanDiagnosis | null
): string | null {
  if (latamPlanIdForTvKind(tvKind, diagnosis)) return null
  const row = diagnosis?.correspondence.find((item) => item.bespokeKind === tvKind)
  if (row?.status === "not_operational") return LATAM_FULL_SIGNUP_BLOCKED
  return LATAM_SIGNUP_MISSING.plan
}

export type LatamRegisterBody = {
  nombres: string
  dni: string
  identificador: string
  password: string
  correo: string
  plan: string
  apellido?: string
  telefono?: string
  direccion?: string
}

export type LatamSignupPreview = {
  customerName: string
  identifier: string
  username: string
  initialPassword: string
  planLabel: string
}

export type LatamSignupAssessment =
  | { ready: false; missing: string[] }
  | { ready: true; body: LatamRegisterBody; preview: LatamSignupPreview }

export type LatamSignupCustomer = {
  name: string
  dni: string | null
  email: string | null
  phone: string | null
  address: string | null
  identifier: string | null
  tvKind: LatamSignupTvKind
  /**
   * pl_id resuelto desde get-plans. Null si no hay correspondencia operativa.
   * Los tests pueden pasar un id explícito para verificar el cuerpo del alta.
   */
  planId: string | null
  planGap?: string | null
}

/** Contraseña inicial: dígitos del DNI. No es el email. */
export function latamInitialPassword(dni: string | null | undefined): string | null {
  const digits = (dni ?? "").replace(/\D/g, "")
  return digits.length >= 7 ? digits : null
}

export function latamStatusLabel(
  input:
    | { kind: "unregistered" }
    | { kind: "registered"; status: "enabled" | "disabled" | null }
    | { kind: "unavailable" }
): string {
  if (input.kind === "unavailable") return "LATAM: No disponible"
  if (input.kind === "unregistered") return "LATAM: No registrado"
  if (input.status === "enabled") return "LATAM: Activo"
  if (input.status === "disabled") return "LATAM: Suspendido"
  return "LATAM: No disponible"
}

export function latamRegisterRejectionMessage(code: number): string {
  switch (code) {
    case 3:
      return "El cliente ya existe en LATAM TV."
    case 4:
      return "LATAM indicó un dispositivo vinculado a otro usuario."
    case 5:
      return "El plan no existe en LATAM TV."
    case 6:
      return "LATAM no pudo vincular el plan."
    case 13:
      return "LATAM no pudo vincular el dispositivo."
    default:
      return "LATAM TV no pudo completar el alta."
  }
}

function usableEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  return trimmed
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed || null
}

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export function latamSignupCustomerGaps(
  input: Omit<LatamSignupCustomer, "planId" | "planGap">
): string[] {
  const { firstName } = splitName(input.name ?? "")
  const missing: string[] = []
  if (!abnetNumberFromExternalCode(input.identifier)) {
    missing.push(LATAM_SIGNUP_MISSING.identifier)
  }
  if (!firstName) missing.push(LATAM_SIGNUP_MISSING.name)
  if (!latamInitialPassword(input.dni)) missing.push(LATAM_SIGNUP_MISSING.nationalId)
  if (!usableEmail(input.email)) missing.push(LATAM_SIGNUP_MISSING.email)
  if (input.tvKind === "other") missing.push(LATAM_SIGNUP_MISSING.tvPlan)
  return missing
}

export function assessLatamSignup(input: LatamSignupCustomer): LatamSignupAssessment {
  const { firstName, lastName } = splitName(input.name ?? "")
  const nationalId = latamInitialPassword(input.dni)
  const email = usableEmail(input.email)
  const identifier = abnetNumberFromExternalCode(input.identifier)
  const planId = input.planId?.trim() || null
  const planLabel = input.tvKind === "other" ? null : PLAN_LABEL[input.tvKind]
  const missing = latamSignupCustomerGaps(input)
  if (!planId) missing.push(input.planGap?.trim() || LATAM_SIGNUP_MISSING.plan)
  if (missing.length > 0 || !identifier || !firstName || !nationalId || !email || !planId || !planLabel) {
    return { ready: false, missing }
  }

  const phone = optionalText(input.phone)
  const address = optionalText(input.address)
  const body: LatamRegisterBody = {
    nombres: firstName,
    dni: nationalId,
    identificador: identifier,
    password: nationalId,
    correo: email,
    plan: planId,
  }
  if (lastName) body.apellido = lastName
  if (phone) body.telefono = phone
  if (address) body.direccion = address

  return {
    ready: true,
    body,
    preview: {
      customerName: input.name.trim(),
      identifier,
      username: email,
      initialPassword: nationalId,
      planLabel,
    },
  }
}
