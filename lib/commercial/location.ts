import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"

export const COMMERCIAL_ACTIVITY_RESULT_OPTIONS = [
  "No respondió",
  "Cliente interesado",
  "Cliente no interesado",
  "Se envió información",
  "Se envió presupuesto",
  "Se acordó visita",
  "Venta realizada",
  "Otro",
] as const

export type CommercialActivityResultOption =
  (typeof COMMERCIAL_ACTIVITY_RESULT_OPTIONS)[number]

export const COMMERCIAL_MANUAL_ACTIVITY_TYPES = [
  "llamada",
  "whatsapp",
  "email",
  "visita",
  "reunion",
  "nota",
] as const satisfies readonly CommercialActivityTypeCode[]

export type CommercialManualActivityType =
  (typeof COMMERCIAL_MANUAL_ACTIVITY_TYPES)[number]

export type CommercialCommitmentPriority = "alta" | "media" | "baja"

export type CommercialCommitmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"

export function composeCommercialAddress(parts: {
  street?: string
  streetNumber?: string
  floor?: string
  apartment?: string
  neighborhood?: string
  city?: string
  province?: string
  postalCode?: string
  address?: string
}): string {
  const streetLine = [parts.street?.trim(), parts.streetNumber?.trim()]
    .filter(Boolean)
    .join(" ")
  const unit = [parts.floor?.trim(), parts.apartment?.trim()]
    .filter(Boolean)
    .join(" ")
  const chunks = [
    streetLine || parts.address?.trim() || "",
    unit,
    parts.neighborhood?.trim() || "",
    parts.city?.trim() || "",
    parts.province?.trim() || "",
    parts.postalCode?.trim() || "",
  ].filter(Boolean)
  return chunks.join(", ")
}

export function buildCommercialGeocodeQuery(address: string): string {
  const trimmed = address.trim()
  if (!trimmed) return ""
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
}

export function isCommercialAddressComplete(parts: {
  street?: string
  streetNumber?: string
  city?: string
  province?: string
}): boolean {
  return Boolean(
    parts.street?.trim() &&
      parts.streetNumber?.trim() &&
      parts.city?.trim() &&
      parts.province?.trim()
  )
}
