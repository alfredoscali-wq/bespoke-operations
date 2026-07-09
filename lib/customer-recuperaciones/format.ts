import type {
  CustomerRecuperacion,
  CustomerRecuperacionChannel,
  CustomerRecuperacionResultado,
} from "@/lib/types/customer-recuperaciones"
import type { VisualTone } from "@/lib/ui/visual-tokens"

const CHANNEL_LABELS: Record<CustomerRecuperacionChannel, string> = {
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  otro: "Otro",
}

const RESULTADO_LABELS: Record<CustomerRecuperacionResultado, string> = {
  recuperado: "Recuperado",
  interesado: "Interesado",
  no_interesado: "No interesado",
  no_responde: "No responde",
  volver_a_contactar: "Volver a contactar",
}

export function formatCustomerRecuperacionChannelLabel(
  channel: CustomerRecuperacionChannel
): string {
  return CHANNEL_LABELS[channel] ?? channel
}

export function formatCustomerRecuperacionResultadoLabel(
  resultado: CustomerRecuperacionResultado
): string {
  return RESULTADO_LABELS[resultado] ?? resultado
}

export function getCustomerRecuperacionResultadoTone(
  resultado: CustomerRecuperacionResultado
): VisualTone {
  switch (resultado) {
    case "recuperado":
      return "green"
    case "interesado":
      return "blue"
    case "no_interesado":
      return "neutral"
    case "no_responde":
      return "amber"
    case "volver_a_contactar":
      return "violet"
  }
}

export function getCustomerRecuperacionDisplayName(
  recuperacion: Pick<
    CustomerRecuperacion,
    "customerId" | "manualCustomerName"
  >,
  customerName?: string | null
): string {
  if (recuperacion.customerId) {
    return customerName?.trim() || "Cliente"
  }

  return recuperacion.manualCustomerName?.trim() || "Cliente"
}

export function getCustomerRecuperacionZoneLabel(
  recuperacion: Pick<CustomerRecuperacion, "customerId" | "manualZone">,
  customerLocality?: string | null
): string | null {
  if (recuperacion.customerId) {
    return customerLocality?.trim() || null
  }

  return recuperacion.manualZone?.trim() || null
}

export const CUSTOMER_RECUPERACION_CHANNEL_OPTIONS = (
  Object.entries(CHANNEL_LABELS) as [CustomerRecuperacionChannel, string][]
).map(([value, label]) => ({ value, label }))

export const CUSTOMER_RECUPERACION_RESULTADO_OPTIONS = (
  Object.entries(RESULTADO_LABELS) as [CustomerRecuperacionResultado, string][]
).map(([value, label]) => ({ value, label }))
