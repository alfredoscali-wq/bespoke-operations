import type {
  CustomerAtencionChannel,
  CustomerAtencionMotivo,
  CustomerAtencionResultado,
} from "@/lib/types/customer-atenciones"

const CHANNEL_LABELS: Record<CustomerAtencionChannel, string> = {
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  presencial: "Presencial",
  otro: "Otro",
}

const MOTIVO_LABELS: Record<CustomerAtencionMotivo, string> = {
  consulta: "Consulta",
  reclamo: "Reclamo",
  solicitud: "Solicitud",
  problema_tecnico: "Problema técnico",
  facturacion: "Facturación",
  baja: "Baja",
  retencion: "Retención",
  otro: "Otro",
}

const RESULTADO_LABELS: Record<CustomerAtencionResultado, string> = {
  resuelta: "Resuelta",
  requiere_seguimiento: "Requiere seguimiento",
  ot_creada: "OT creada",
}

export function formatCustomerAtencionChannelLabel(
  channel: CustomerAtencionChannel
): string {
  return CHANNEL_LABELS[channel] ?? channel
}

export function formatCustomerAtencionMotivoLabel(
  motivo: CustomerAtencionMotivo
): string {
  return MOTIVO_LABELS[motivo] ?? motivo
}

export function formatCustomerAtencionResultadoLabel(
  resultado: CustomerAtencionResultado
): string {
  return RESULTADO_LABELS[resultado] ?? resultado
}

export const CUSTOMER_ATENCION_CHANNEL_OPTIONS = (
  Object.entries(CHANNEL_LABELS) as [CustomerAtencionChannel, string][]
).map(([value, label]) => ({ value, label }))

export const CUSTOMER_ATENCION_MOTIVO_OPTIONS = (
  Object.entries(MOTIVO_LABELS) as [CustomerAtencionMotivo, string][]
).map(([value, label]) => ({ value, label }))
