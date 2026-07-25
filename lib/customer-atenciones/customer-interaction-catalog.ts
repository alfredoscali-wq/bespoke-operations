/**
 * Sprint 1.1C — unified customer interaction catalog (medio + resultado).
 * Shared by Atención, Morosos and Retenciones. No tray/workflow mutation.
 */

import type { CustomerAtencionNextStep } from "@/lib/types/customer-atenciones"
import { formatCustomerAtencionNextStepLabel } from "@/lib/customer-atenciones/format"

export const CUSTOMER_INTERACTION_MEDIA = [
  "llamada_telefonica",
  "whatsapp",
  "email",
  "sms",
  "presencial",
  "otro",
] as const

export type CustomerInteractionMedium =
  (typeof CUSTOMER_INTERACTION_MEDIA)[number]

export const CUSTOMER_INTERACTION_MEDIA_LABELS: Record<
  CustomerInteractionMedium,
  string
> = {
  llamada_telefonica: "Llamada telefónica",
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  presencial: "Presencial",
  otro: "Otro",
}

export const CUSTOMER_INTERACTION_MEDIA_OPTIONS =
  CUSTOMER_INTERACTION_MEDIA.map((value) => ({
    value,
    label: CUSTOMER_INTERACTION_MEDIA_LABELS[value],
  }))

/** Results shared across phone / SMS / in-person / other. */
export const CUSTOMER_INTERACTION_GENERAL_RESULTS = [
  "contacto_exitoso",
  "no_respondio",
  "linea_ocupada",
  "telefono_apagado",
  "numero_incorrecto",
  "mensaje_enviado",
  "esperando_respuesta",
  "cliente_solicita_devolucion",
  "cliente_solicita_volver_a_llamar",
  "cliente_rechazo_contacto",
] as const

export type CustomerInteractionGeneralResult =
  (typeof CUSTOMER_INTERACTION_GENERAL_RESULTS)[number]

export const CUSTOMER_INTERACTION_GENERAL_RESULT_LABELS: Record<
  CustomerInteractionGeneralResult,
  string
> = {
  contacto_exitoso: "Contacto exitoso",
  no_respondio: "No respondió",
  linea_ocupada: "Línea ocupada",
  telefono_apagado: "Teléfono apagado",
  numero_incorrecto: "Número incorrecto",
  mensaje_enviado: "Mensaje enviado",
  esperando_respuesta: "Esperando respuesta",
  cliente_solicita_devolucion: "Cliente solicita devolución",
  cliente_solicita_volver_a_llamar: "Cliente solicita volver a llamar",
  cliente_rechazo_contacto: "Cliente rechazó contacto",
}

export const CUSTOMER_INTERACTION_WHATSAPP_RESULTS = [
  "enviado",
  "leido",
  "respondido",
  "sin_respuesta",
] as const

export type CustomerInteractionWhatsappResult =
  (typeof CUSTOMER_INTERACTION_WHATSAPP_RESULTS)[number]

export const CUSTOMER_INTERACTION_WHATSAPP_RESULT_LABELS: Record<
  CustomerInteractionWhatsappResult,
  string
> = {
  enviado: "Enviado",
  leido: "Leído",
  respondido: "Respondido",
  sin_respuesta: "Sin respuesta",
}

export const CUSTOMER_INTERACTION_EMAIL_RESULTS = [
  "enviado",
  "respondido",
  "rebotado",
] as const

export type CustomerInteractionEmailResult =
  (typeof CUSTOMER_INTERACTION_EMAIL_RESULTS)[number]

export const CUSTOMER_INTERACTION_EMAIL_RESULT_LABELS: Record<
  CustomerInteractionEmailResult,
  string
> = {
  enviado: "Enviado",
  respondido: "Respondido",
  rebotado: "Rebotado",
}

export type CustomerInteractionResult =
  | CustomerInteractionGeneralResult
  | CustomerInteractionWhatsappResult
  | CustomerInteractionEmailResult

const ALL_RESULT_LABELS: Record<string, string> = {
  ...CUSTOMER_INTERACTION_GENERAL_RESULT_LABELS,
  ...CUSTOMER_INTERACTION_WHATSAPP_RESULT_LABELS,
  ...CUSTOMER_INTERACTION_EMAIL_RESULT_LABELS,
}

export function isCustomerInteractionMedium(
  value: string
): value is CustomerInteractionMedium {
  return (CUSTOMER_INTERACTION_MEDIA as readonly string[]).includes(value)
}

export function formatCustomerInteractionMediumLabel(
  medium: string | null | undefined
): string | null {
  if (!medium?.trim()) {
    return null
  }
  if (isCustomerInteractionMedium(medium)) {
    return CUSTOMER_INTERACTION_MEDIA_LABELS[medium]
  }
  return medium.trim()
}

export function formatCustomerInteractionResultLabel(
  result: string | null | undefined
): string | null {
  if (!result?.trim()) {
    return null
  }
  return ALL_RESULT_LABELS[result] ?? result.trim()
}

export function getCustomerInteractionResultOptions(
  medium: CustomerInteractionMedium | ""
): { value: string; label: string }[] {
  if (medium === "whatsapp") {
    return CUSTOMER_INTERACTION_WHATSAPP_RESULTS.map((value) => ({
      value,
      label: CUSTOMER_INTERACTION_WHATSAPP_RESULT_LABELS[value],
    }))
  }
  if (medium === "email") {
    return CUSTOMER_INTERACTION_EMAIL_RESULTS.map((value) => ({
      value,
      label: CUSTOMER_INTERACTION_EMAIL_RESULT_LABELS[value],
    }))
  }
  return CUSTOMER_INTERACTION_GENERAL_RESULTS.map((value) => ({
    value,
    label: CUSTOMER_INTERACTION_GENERAL_RESULT_LABELS[value],
  }))
}

export function isValidCustomerInteractionResult(
  medium: CustomerInteractionMedium,
  result: string
): boolean {
  return getCustomerInteractionResultOptions(medium).some(
    (option) => option.value === result
  )
}

export function buildCustomerInteractionActivityTitle(
  medium: CustomerInteractionMedium
): string {
  switch (medium) {
    case "llamada_telefonica":
      return "Llamada realizada"
    case "whatsapp":
      return "WhatsApp enviado"
    case "email":
      return "Correo enviado"
    case "sms":
      return "SMS enviado"
    case "presencial":
      return "Contacto presencial"
    default:
      return "Interacción registrada"
  }
}

export function buildCustomerInteractionActivityDescription(input: {
  employeeName: string
  medium: CustomerInteractionMedium
  result: string
}): string {
  const mediumLabel = CUSTOMER_INTERACTION_MEDIA_LABELS[input.medium]
  const resultLabel =
    formatCustomerInteractionResultLabel(input.result) ?? input.result
  const actor = input.employeeName.trim() || "Un operador"

  if (input.medium === "llamada_telefonica") {
    return `${actor} realizó una llamada telefónica. Resultado: ${resultLabel}.`
  }
  if (input.medium === "whatsapp") {
    return `${actor} registró un WhatsApp. Resultado: ${resultLabel}.`
  }
  if (input.medium === "email") {
    return `${actor} registró un correo. Resultado: ${resultLabel}.`
  }
  if (input.medium === "sms") {
    return `${actor} registró un SMS. Resultado: ${resultLabel}.`
  }
  if (input.medium === "presencial") {
    return `${actor} registró un contacto presencial. Resultado: ${resultLabel}.`
  }
  return `${actor} registró una interacción (${mediumLabel}). Resultado: ${resultLabel}.`
}

/**
 * Historial del expediente — formato legible de gestión.
 * Observaciones opcionales; next_step solo si el operador lo indicó.
 */
export function buildCustomerInteractionHistorialDetail(input: {
  medium: CustomerInteractionMedium
  result: string
  observations?: string | null
  nextStep?: CustomerAtencionNextStep | string | null
  previousNextStep?: CustomerAtencionNextStep | string | null
}): string {
  const mediumLabel = CUSTOMER_INTERACTION_MEDIA_LABELS[input.medium]
  const resultLabel =
    formatCustomerInteractionResultLabel(input.result) ?? input.result
  const lines = [mediumLabel, "", "Resultado:", resultLabel]

  const observations = input.observations?.trim()
  if (observations) {
    lines.push("", "Observación:", observations)
  }

  const nextStep = input.nextStep?.trim() || null
  const previous = input.previousNextStep?.trim() || null
  if (nextStep && nextStep !== previous) {
    const nextLabel =
      formatCustomerAtencionNextStepLabel(
        nextStep as CustomerAtencionNextStep
      ) || nextStep
    lines.push("", "Próximo paso indicado:", nextLabel)
  }

  return lines.join("\n")
}

export function validateCustomerInteractionInput(input: {
  medium?: string | null
  result?: string | null
  observations?: string | null
  nextStep?: string | null
}):
  | {
      medium: CustomerInteractionMedium
      result: string
      observations: string | null
      nextStep: string | null
    }
  | { error: string } {
  const mediumRaw = input.medium?.trim() ?? ""
  if (!isCustomerInteractionMedium(mediumRaw)) {
    return { error: "Seleccioná el medio de contacto." }
  }

  const resultRaw = input.result?.trim() ?? ""
  if (!resultRaw || !isValidCustomerInteractionResult(mediumRaw, resultRaw)) {
    return { error: "Seleccioná el resultado del contacto." }
  }

  const observations = input.observations?.trim() || null
  const nextStep = input.nextStep?.trim() || null

  return {
    medium: mediumRaw,
    result: resultRaw,
    observations,
    nextStep,
  }
}
