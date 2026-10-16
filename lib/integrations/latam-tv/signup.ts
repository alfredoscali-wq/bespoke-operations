import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import type { LatamTvPlanDiagnosis } from "@/lib/integrations/latam-tv/plans"

function signupIdentifier(value: string | null | undefined): string | null {
  return abnetNumberFromExternalCode(value)
}

/**
 * Alta LATAM TV.
 *
 * Regla definitiva de acceso:
 * - El usuario de LATAM es el email del cliente (`correo`).
 * - La contraseña inicial es el DNI del cliente, solo dígitos.
 * - No se genera una contraseña aleatoria, no se pide al operador
 *   y no se usa el email como contraseña.
 * - `identificador` se envía solo cuando ya es el abonado numérico de ABNet.
 *   Un alta nueva no envía el número CLI: Latam asigna el suyo.
 * - El pl_id de get-plans viaja en `root.carroCompra.plan.id`.
 *   TV Full no se usa en el alta. Si no hay correspondencia, no se inventa un id.
 * - El padrón guarda el apellido antes del nombre. `appaterno` y, si se
 *   distinguen, `apmaterno` salen de esa cadena. No se envía `apellido`.
 * - No se envían dispositivos, fecha de nacimiento ni el objeto dirección:
 *   la documentación exige ids de país, región y comuna que este alta no tiene.
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
  "TV Full no está disponible en LATAM."

export const LATAM_SIGNUP_MISSING_EMAIL =
  "No se puede dar de alta al cliente en Latam porque falta el email en Clientes 360."
export const LATAM_SIGNUP_MISSING_DNI =
  "No se puede dar de alta al cliente en Latam porque falta el DNI en Clientes 360."
export const LATAM_SIGNUP_MISSING_BOTH =
  "No se puede dar de alta al cliente en Latam porque faltan el email y el DNI en Clientes 360."

export type LatamSignupCredentialGap = "email" | "dni" | "both"

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
 * no se inventa un pl_id. TV Full no tiene pl_id y no se usa
 * para altas ni para el cambio futuro.
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
  if (tvKind === "full") return LATAM_FULL_SIGNUP_BLOCKED
  if (latamPlanIdForTvKind(tvKind, diagnosis)) return null
  return LATAM_SIGNUP_MISSING.plan
}

export type LatamRegisterBody = {
  nombres: string
  dni: string
  identificador?: string
  password: string
  correo: string
  plan: string
  appaterno?: string
  apmaterno?: string
  telefono?: string
}

export type LatamRegisterRequest = {
  root: {
    usuario: {
      nombres: string
      dni: string
      password: string
      correo: string
      appaterno?: string
      apmaterno?: string
      identificador?: string
      telefono?: string
    }
    carroCompra: {
      plan: { id: string }
    }
  }
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
  /** Alta sin abonado ABNet. No copia el número de Bespoke al identificador. */
  identitySignup?: boolean
}

export function latamSignupCredentialGap(
  dni: string | null | undefined,
  email: string | null | undefined
): LatamSignupCredentialGap | null {
  const hasDni = Boolean(latamInitialPassword(dni))
  const hasEmail = Boolean(usableEmail(email))
  if (hasDni && hasEmail) return null
  if (!hasDni && !hasEmail) return "both"
  return hasEmail ? "dni" : "email"
}

export function latamSignupCredentialMessage(gap: LatamSignupCredentialGap): string {
  if (gap === "both") return LATAM_SIGNUP_MISSING_BOTH
  if (gap === "email") return LATAM_SIGNUP_MISSING_EMAIL
  return LATAM_SIGNUP_MISSING_DNI
}

/** Contraseña inicial: dígitos del DNI. No es el email ni el número de cliente. */
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

/**
 * Mensaje operativo de register-client.
 * No afirma que el usuario no haya sido creado.
 * Los mismos números significan otra cosa en sync-client y en modify-client.
 */
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

const SURNAME_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "da",
  "do",
  "dos",
  "di",
  "van",
  "von",
  "y",
])

/**
 * El padrón escribe el apellido primero y el nombre al final.
 * Un apellido compuesto con partícula queda entero en appaterno.
 * Dos apellidos sueltos se separan en appaterno y apmaterno.
 */
export function splitLatamPersonName(name: string): {
  nombres: string
  appaterno?: string
  apmaterno?: string
} {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { nombres: "" }
  if (parts.length === 1) return { nombres: parts[0] }
  const nombres = parts[parts.length - 1]
  const surnames = parts.slice(0, -1)
  const compound = surnames.some((part) => SURNAME_PARTICLES.has(part.toLowerCase()))
  if (compound || surnames.length !== 2) {
    return { nombres, appaterno: surnames.join(" ") }
  }
  return { nombres, appaterno: surnames[0], apmaterno: surnames[1] }
}

export function latamSignupCustomerGaps(
  input: Omit<LatamSignupCustomer, "planId" | "planGap">
): string[] {
  const person = splitLatamPersonName(input.name ?? "")
  const missing: string[] = []
  if (!signupIdentifier(input.identifier) && !input.identitySignup) {
    missing.push(LATAM_SIGNUP_MISSING.identifier)
  }
  if (!person.nombres) missing.push(LATAM_SIGNUP_MISSING.name)
  if (!latamInitialPassword(input.dni)) missing.push(LATAM_SIGNUP_MISSING.nationalId)
  if (!usableEmail(input.email)) missing.push(LATAM_SIGNUP_MISSING.email)
  if (input.tvKind === "other") missing.push(LATAM_SIGNUP_MISSING.tvPlan)
  return missing
}

export function toLatamRegisterRequest(body: LatamRegisterBody): LatamRegisterRequest {
  const usuario: LatamRegisterRequest["root"]["usuario"] = {
    nombres: body.nombres,
    dni: body.dni,
    password: body.password,
    correo: body.correo,
  }
  if (body.appaterno) usuario.appaterno = body.appaterno
  if (body.apmaterno) usuario.apmaterno = body.apmaterno
  if (body.identificador) usuario.identificador = body.identificador
  if (body.telefono) usuario.telefono = body.telefono
  return {
    root: {
      usuario,
      carroCompra: { plan: { id: body.plan } },
    },
  }
}

export function assessLatamSignup(input: LatamSignupCustomer): LatamSignupAssessment {
  const person = splitLatamPersonName(input.name ?? "")
  const nationalId = latamInitialPassword(input.dni)
  const email = usableEmail(input.email)
  const identifier = signupIdentifier(input.identifier)
  const planId = input.planId?.trim() || null
  const planLabel = input.tvKind === "other" ? null : PLAN_LABEL[input.tvKind]
  const missing = latamSignupCustomerGaps(input)
  if (!planId) missing.push(input.planGap?.trim() || LATAM_SIGNUP_MISSING.plan)
  if (
    missing.length > 0 ||
    !person.nombres ||
    !nationalId ||
    !email ||
    !planId ||
    !planLabel ||
    (!identifier && !input.identitySignup)
  ) {
    return { ready: false, missing }
  }

  const phone = optionalText(input.phone)
  const body: LatamRegisterBody = {
    nombres: person.nombres,
    dni: nationalId,
    password: nationalId,
    correo: email,
    plan: planId,
  }
  if (person.appaterno) body.appaterno = person.appaterno
  if (person.apmaterno) body.apmaterno = person.apmaterno
  if (identifier) body.identificador = identifier
  if (phone) body.telefono = phone

  return {
    ready: true,
    body,
    preview: {
      customerName: input.name.trim(),
      identifier: identifier ?? "",
      username: email,
      initialPassword: nationalId,
      planLabel,
    },
  }
}
