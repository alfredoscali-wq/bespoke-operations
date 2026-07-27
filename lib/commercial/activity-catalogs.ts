export const COMMERCIAL_ACTIVITY_TYPE_CODES = [
  "llamada",
  "whatsapp",
  "email",
  "visita",
  "reunion",
  "nota",
  "tarea",
  "seguimiento",
  "cambio_estado",
  "derivacion",
  "sistema",
] as const

export type CommercialActivityTypeCode =
  (typeof COMMERCIAL_ACTIVITY_TYPE_CODES)[number]

export const COMMERCIAL_ACTIVITY_STATUSES = ["pending", "completed"] as const

export type CommercialActivityStatus =
  (typeof COMMERCIAL_ACTIVITY_STATUSES)[number]

export const COMMERCIAL_ACTIVITY_STATUS_LABELS: Record<
  CommercialActivityStatus,
  string
> = {
  pending: "Pendiente",
  completed: "Completada",
}

export const COMMERCIAL_ACTIVITY_TYPE_LABELS: Record<
  CommercialActivityTypeCode,
  string
> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  email: "Email",
  visita: "Visita",
  reunion: "Reunión",
  nota: "Nota",
  tarea: "Tarea",
  seguimiento: "Seguimiento",
  cambio_estado: "Cambio de Estado",
  derivacion: "Derivación desde Atención al Cliente",
  sistema: "Sistema",
}

export const COMMERCIAL_QUICK_ACTIVITY_TYPES = [
  "llamada",
  "whatsapp",
  "email",
  "visita",
  "reunion",
  "nota",
] as const satisfies readonly CommercialActivityTypeCode[]

export type CommercialQuickActivityType =
  (typeof COMMERCIAL_QUICK_ACTIVITY_TYPES)[number]

export function isCommercialActivityStatus(
  value: string
): value is CommercialActivityStatus {
  return (COMMERCIAL_ACTIVITY_STATUSES as readonly string[]).includes(value)
}

export function isCommercialActivityTypeCode(
  value: string
): value is CommercialActivityTypeCode {
  return (COMMERCIAL_ACTIVITY_TYPE_CODES as readonly string[]).includes(value)
}
