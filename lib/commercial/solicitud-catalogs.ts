export const COMMERCIAL_SOLICITUD_STATUS_CODES = [
  "nueva",
  "en_gestion",
  "ot_generada",
  "finalizada",
  "cancelada",
] as const

export type CommercialSolicitudStatusCode =
  (typeof COMMERCIAL_SOLICITUD_STATUS_CODES)[number]

export const COMMERCIAL_SOLICITUD_STATUS_LABELS: Record<
  CommercialSolicitudStatusCode,
  string
> = {
  nueva: "Nueva",
  en_gestion: "En Gestión",
  ot_generada: "OT Generada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
}

export const COMMERCIAL_SOLICITUD_PRIORITY_CODES = [
  "baja",
  "normal",
  "alta",
  "urgente",
] as const

export type CommercialSolicitudPriorityCode =
  (typeof COMMERCIAL_SOLICITUD_PRIORITY_CODES)[number]

export const COMMERCIAL_SOLICITUD_PRIORITY_LABELS: Record<
  CommercialSolicitudPriorityCode,
  string
> = {
  baja: "Baja",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
}

/** Global resolution codes — prepared for future tenant configuration. */
export const COMMERCIAL_SOLICITUD_RESOLUTION_CODES = [
  "venta_concretada",
  "cliente_desistio",
  "no_interesado",
  "sin_cobertura",
  "cancelada",
  "pendiente_decision",
] as const

export type CommercialSolicitudResolutionCode =
  (typeof COMMERCIAL_SOLICITUD_RESOLUTION_CODES)[number]

export const COMMERCIAL_SOLICITUD_RESOLUTION_LABELS: Record<
  CommercialSolicitudResolutionCode,
  string
> = {
  venta_concretada: "Venta concretada",
  cliente_desistio: "Cliente desistió",
  no_interesado: "No interesado",
  sin_cobertura: "Sin cobertura",
  cancelada: "Cancelada",
  pendiente_decision: "Pendiente de decisión",
}

export const COMMERCIAL_SOLICITUD_RESOLUTION_RESULTING_STATUS: Record<
  CommercialSolicitudResolutionCode,
  CommercialSolicitudStatusCode
> = {
  venta_concretada: "en_gestion",
  cliente_desistio: "finalizada",
  no_interesado: "finalizada",
  sin_cobertura: "finalizada",
  cancelada: "cancelada",
  pendiente_decision: "en_gestion",
}

export const COMMERCIAL_SOLICITUD_CODE_PREFIX = "SOL-"

export const DEFAULT_COMMERCIAL_SOLICITUD_TYPE_SEEDS = [
  { name: "Internet", color: "#2563eb", sortOrder: 10 },
  { name: "Televisión", color: "#7c3aed", sortOrder: 20 },
  { name: "Telefonía", color: "#0891b2", sortOrder: 30 },
  { name: "Combo", color: "#16a34a", sortOrder: 40 },
  { name: "Otro", color: "#64748b", sortOrder: 50 },
] as const

export function isCommercialSolicitudStatusCode(
  value: string
): value is CommercialSolicitudStatusCode {
  return (COMMERCIAL_SOLICITUD_STATUS_CODES as readonly string[]).includes(value)
}

export function isCommercialSolicitudPriorityCode(
  value: string
): value is CommercialSolicitudPriorityCode {
  return (COMMERCIAL_SOLICITUD_PRIORITY_CODES as readonly string[]).includes(
    value
  )
}

export function isCommercialSolicitudResolutionCode(
  value: string
): value is CommercialSolicitudResolutionCode {
  return (COMMERCIAL_SOLICITUD_RESOLUTION_CODES as readonly string[]).includes(
    value
  )
}

export function commercialSolicitudAllowsOtGeneration(
  resolution: CommercialSolicitudResolutionCode | null | undefined,
  workOrderId: string | null | undefined
): boolean {
  return resolution === "venta_concretada" && !workOrderId
}
