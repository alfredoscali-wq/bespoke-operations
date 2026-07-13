import type {
  CustomerAtencionChannel,
  CustomerAtencionMotivo,
  CustomerAtencionNextStep,
  CustomerAtencionResultado,
  CustomerAtencionStatus,
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

const STATUS_LABELS: Record<CustomerAtencionStatus, string> = {
  nueva: "Nueva",
  para_resolver: "Para resolver",
  en_gestion: "En gestión",
  pendiente: "Pendiente",
  resuelta: "Resuelta",
}

const NEXT_STEP_LABELS: Record<CustomerAtencionNextStep, string> = {
  realizar_retencion: "Realizar retención",
  resolver_facturacion: "Resolver facturación",
  analizar_problema_tecnico: "Analizar problema técnico",
  contactar_cliente: "Derivar a Ventas",
  esperar_cliente: "Esperar cliente",
  esperar_administracion: "Esperar Administración",
  coordinar_retiro: "Coordinar retiro",
  generar_ot: "Generar OT",
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

export function formatCustomerAtencionStatusLabel(
  status: CustomerAtencionStatus
): string {
  return STATUS_LABELS[status] ?? status
}

export function formatCustomerAtencionNextStepLabel(
  nextStep: CustomerAtencionNextStep
): string {
  return NEXT_STEP_LABELS[nextStep] ?? nextStep
}

export const CUSTOMER_ATENCION_CHANNEL_OPTIONS = (
  Object.entries(CHANNEL_LABELS) as [CustomerAtencionChannel, string][]
).map(([value, label]) => ({ value, label }))

export const CUSTOMER_ATENCION_MOTIVO_OPTIONS = (
  Object.entries(MOTIVO_LABELS) as [CustomerAtencionMotivo, string][]
).map(([value, label]) => ({ value, label }))

export const CUSTOMER_ATENCION_NEXT_STEP_OPTIONS = (
  Object.entries(NEXT_STEP_LABELS) as [CustomerAtencionNextStep, string][]
).map(([value, label]) => ({ value, label }))
