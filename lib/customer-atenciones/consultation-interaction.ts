/**
 * Generic consultation interaction pattern (Atención al Cliente).
 * Independent of consultation tray state and of circuit-specific process columns.
 */

import {
  isMorosoTrackingStatus,
  MOROSO_TRACKING_STATUS_LABELS,
} from "@/lib/customer-atenciones/moroso-flow"

export const CONSULTATION_INTERACTION_KINDS = [
  "contact",
  "note",
  "process",
  "decision",
  "system",
] as const

export type ConsultationInteractionKind =
  (typeof CONSULTATION_INTERACTION_KINDS)[number]

export const CONSULTATION_INTERACTION_KIND_LABELS: Record<
  ConsultationInteractionKind,
  string
> = {
  contact: "Contacto",
  note: "Nota",
  process: "Proceso",
  decision: "Decisión",
  system: "Sistema",
}

export function isConsultationInteractionKind(
  value: string
): value is ConsultationInteractionKind {
  return (CONSULTATION_INTERACTION_KINDS as readonly string[]).includes(value)
}

/** Morosos (and reusable) contact results — first vertical catalog. */
export const MOROSO_CONTACT_RESULTS = [
  "no_atiende",
  "telefono_apagado",
  "whatsapp_sin_respuesta",
  "ocupado",
  "habla_tercero",
  "contacto_sin_acuerdo",
  "promesa_pago",
] as const

export type MorosoContactResult = (typeof MOROSO_CONTACT_RESULTS)[number]

export const MOROSO_CONTACT_RESULT_LABELS: Record<MorosoContactResult, string> =
  {
    no_atiende: "No atiende",
    telefono_apagado: "Teléfono apagado",
    whatsapp_sin_respuesta: "WhatsApp sin respuesta",
    ocupado: "Ocupado",
    habla_tercero: "Habla un tercero",
    contacto_sin_acuerdo: "Contacto sin acuerdo",
    promesa_pago: "Promesa de pago",
  }

export function isMorosoContactResult(
  value: string
): value is MorosoContactResult {
  return (MOROSO_CONTACT_RESULTS as readonly string[]).includes(value)
}

export const MOROSO_CONTACT_RESULT_OPTIONS = MOROSO_CONTACT_RESULTS.map(
  (value) => ({
    value,
    label: MOROSO_CONTACT_RESULT_LABELS[value],
  })
)

export type NextActionPreset = "none" | "today" | "tomorrow" | "custom"

export function resolveNextActionAt(
  preset: NextActionPreset,
  customIso?: string | null
): string | null {
  if (preset === "none") {
    return null
  }

  if (preset === "custom") {
    const trimmed = customIso?.trim() ?? ""
    if (!trimmed) {
      return null
    }
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    return parsed.toISOString()
  }

  const base = new Date()
  if (preset === "tomorrow") {
    base.setDate(base.getDate() + 1)
  }
  base.setHours(10, 0, 0, 0)
  return base.toISOString()
}

export function validateRegisterInteractionInput(input: {
  kind: string
  result?: string | null
  detail?: string | null
  nextActionAt?: string | null
}):
  | {
      kind: ConsultationInteractionKind
      result: string | null
      detail: string
      nextActionAt: string | null
    }
  | { error: string } {
  if (!isConsultationInteractionKind(input.kind)) {
    return { error: "Seleccioná un tipo de interacción válido." }
  }

  const detail = input.detail?.trim() ?? ""
  if (!detail) {
    return { error: "Completá el detalle de la interacción." }
  }

  const result = input.result?.trim() ? input.result.trim() : null

  let nextActionAt: string | null = null
  if (input.nextActionAt?.trim()) {
    const parsed = new Date(input.nextActionAt.trim())
    if (Number.isNaN(parsed.getTime())) {
      return { error: "La fecha de próxima acción no es válida." }
    }
    nextActionAt = parsed.toISOString()
  }

  return {
    kind: input.kind,
    result,
    detail,
    nextActionAt,
  }
}

export function formatInteractionResultLabel(
  kind: ConsultationInteractionKind | null | undefined,
  result: string | null | undefined
): string | null {
  if (!result?.trim()) {
    return null
  }

  if (kind === "contact" && isMorosoContactResult(result)) {
    return MOROSO_CONTACT_RESULT_LABELS[result]
  }

  if (kind === "process" && isMorosoTrackingStatus(result)) {
    return MOROSO_TRACKING_STATUS_LABELS[result]
  }

  return result
}

export function buildInteractionNarrative(input: {
  kind: ConsultationInteractionKind | null | undefined
  result: string | null | undefined
  detail: string | null | undefined
  nextActionAt?: string | null
  employeeName?: string | null
}): string {
  const resultLabel = formatInteractionResultLabel(input.kind, input.result)
  const actor = input.employeeName?.trim() || null
  const parts: string[] = []

  if (input.kind === "contact") {
    if (actor) {
      parts.push(`Contacto registrado por ${actor}.`)
    } else {
      parts.push("Contacto registrado.")
    }
    if (resultLabel) {
      parts.push(`Resultado: ${resultLabel}.`)
    }
  } else if (input.kind === "process") {
    if (actor) {
      parts.push(`Proceso actualizado por ${actor}.`)
    }
    if (resultLabel) {
      parts.push(`Estado: ${resultLabel}.`)
    } else {
      parts.push("Proceso actualizado.")
    }
  } else if (input.kind === "note") {
    parts.push(actor ? `Nota de ${actor}.` : "Nota registrada.")
  } else {
    parts.push(actor ? `Interacción registrada por ${actor}.` : "Interacción registrada.")
    if (resultLabel) {
      parts.push(resultLabel)
    }
  }

  if (input.detail?.trim()) {
    parts.push(input.detail.trim())
  }

  if (input.nextActionAt) {
    const when = new Date(input.nextActionAt).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    parts.push(`Próxima acción: ${when}.`)
  }

  return parts.join(" ")
}
