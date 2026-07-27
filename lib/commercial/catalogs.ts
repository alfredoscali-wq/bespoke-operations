export const COMMERCIAL_PERSON_TYPES = [
  "individual",
  "company",
] as const

export type CommercialPersonType = (typeof COMMERCIAL_PERSON_TYPES)[number]

export const COMMERCIAL_STATUS_CODES = [
  "nueva",
  "contactada",
  "calificada",
  "propuesta_enviada",
  "negociacion",
  "ganada",
  "perdida",
] as const

export type CommercialStatusCode = (typeof COMMERCIAL_STATUS_CODES)[number]

export const COMMERCIAL_PRIORITY_CODES = ["alta", "media", "baja"] as const

export type CommercialPriorityCode = (typeof COMMERCIAL_PRIORITY_CODES)[number]

export const COMMERCIAL_SOURCE_CODES = [
  "whatsapp",
  "llamada",
  "web",
  "facebook",
  "instagram",
  "referido",
  "sucursal",
  "atencion_cliente",
  "otro",
] as const

export type CommercialSourceCode = (typeof COMMERCIAL_SOURCE_CODES)[number]

export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatusCode, string> = {
  nueva: "Nueva",
  contactada: "Contactada",
  calificada: "Calificada",
  propuesta_enviada: "Propuesta Enviada",
  negociacion: "Negociación",
  ganada: "Ganada",
  perdida: "Perdida",
}

export const COMMERCIAL_PRIORITY_LABELS: Record<CommercialPriorityCode, string> =
  {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  }

export const COMMERCIAL_SOURCE_LABELS: Record<CommercialSourceCode, string> = {
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  web: "Web",
  facebook: "Facebook",
  instagram: "Instagram",
  referido: "Referido",
  sucursal: "Sucursal",
  atencion_cliente: "Atención al Cliente",
  otro: "Otro",
}

export const COMMERCIAL_LOCATION_SOURCES = [
  "manual",
  "gps",
  "customer_service",
  "import",
] as const

export type CommercialLocationSource =
  (typeof COMMERCIAL_LOCATION_SOURCES)[number]

export const COMMERCIAL_LOCATION_SOURCE_LABELS: Record<
  CommercialLocationSource,
  string
> = {
  manual: "Manual",
  gps: "GPS",
  customer_service: "Atención al Cliente",
  import: "Importación",
}

export const COMMERCIAL_STATUS_MAP_COLORS: Record<CommercialStatusCode, string> =
  {
    nueva: "#6b7280",
    contactada: "#2563eb",
    calificada: "#eab308",
    propuesta_enviada: "#f97316",
    negociacion: "#7c3aed",
    ganada: "#16a34a",
    perdida: "#dc2626",
  }

export const COMMERCIAL_OPPORTUNITY_CODE_PREFIX = "OP-"

export function isCommercialStatusCode(
  value: string
): value is CommercialStatusCode {
  return (COMMERCIAL_STATUS_CODES as readonly string[]).includes(value)
}

export function isCommercialPriorityCode(
  value: string
): value is CommercialPriorityCode {
  return (COMMERCIAL_PRIORITY_CODES as readonly string[]).includes(value)
}

export function isCommercialSourceCode(
  value: string
): value is CommercialSourceCode {
  return (COMMERCIAL_SOURCE_CODES as readonly string[]).includes(value)
}

export function isCommercialLocationSource(
  value: string
): value is CommercialLocationSource {
  return (COMMERCIAL_LOCATION_SOURCES as readonly string[]).includes(value)
}

export function formatCommercialOpportunityCode(sequence: number): string {
  return `${COMMERCIAL_OPPORTUNITY_CODE_PREFIX}${String(sequence).padStart(6, "0")}`
}
