import type { CustomerAtencionEventActionType } from "@/lib/types/customer-atencion-events"
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

/** RC 3.1.6 — reason the customer contacted (ordered for the form select). */
const MOTIVO_LABELS: Record<CustomerAtencionMotivo, string> = {
  problema_tecnico: "Problema técnico",
  facturacion: "Facturación",
  cambio_plan_tecnologia: "Cambio de Plan / Tecnología",
  consulta_comercial: "Consulta Comercial",
  consulta_tv: "Consulta sobre TV",
  nuevo_servicio: "Nuevo servicio",
  baja: "Baja del servicio",
  otro: "Otro",
}

export const CUSTOMER_ATENCION_MOTIVO_ORDER = [
  "problema_tecnico",
  "facturacion",
  "cambio_plan_tecnologia",
  "consulta_comercial",
  "consulta_tv",
  "nuevo_servicio",
  "baja",
  "otro",
] as const satisfies readonly CustomerAtencionMotivo[]

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

/** Ordered Próximo Paso menu (Resolve → Derivaciones → Seguimiento → Operación). */
const NEXT_STEP_LABELS: Record<CustomerAtencionNextStep, string> = {
  realizar_retencion: "Realizar Retención",
  resolver_consulta_tecnica: "Resolver consulta técnica",
  derivar_admin_facturacion: "Derivar Administración - Facturación",
  derivar_admin_morosos: "Derivar Administración - Morosos",
  derivar_admin_gestion: "Derivar Administración - Gestión administrativa",
  contactar_cliente: "Derivar a Ventas",
  seguimiento_cliente: "Requiere contacto con el cliente",
  esperar_cliente: "Esperar respuesta del cliente",
  generar_ot: "Generar OT",
}

export const CUSTOMER_ATENCION_NEXT_STEP_MENU_ORDER = [
  "realizar_retencion",
  "resolver_consulta_tecnica",
  "derivar_admin_facturacion",
  "derivar_admin_morosos",
  "derivar_admin_gestion",
  "contactar_cliente",
  "seguimiento_cliente",
  "esperar_cliente",
  "generar_ot",
] as const satisfies readonly CustomerAtencionNextStep[]

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

/**
 * MAX(created_at) per atención from seguimientos and/or atencion events.
 * `consulta_creada` is ignored so creation alone does not count as a gestión.
 */
export function computeLatestManagementAtByAtencionId(input: {
  seguimientos?: ReadonlyArray<{
    source_atencion_id: string | null
    created_at: string | null
  }>
  events?: ReadonlyArray<{
    customer_atencion_id: string | null
    created_at: string | null
    action_type?: string | null
  }>
}): Map<string, string> {
  const result = new Map<string, string>()

  function absorb(atencionId: string | null | undefined, createdAt: string | null | undefined) {
    if (!atencionId || !createdAt) {
      return
    }
    const previous = result.get(atencionId)
    if (!previous || createdAt > previous) {
      result.set(atencionId, createdAt)
    }
  }

  for (const row of input.seguimientos ?? []) {
    absorb(row.source_atencion_id, row.created_at)
  }

  for (const row of input.events ?? []) {
    if (row.action_type === "consulta_creada") {
      continue
    }
    absorb(row.customer_atencion_id, row.created_at)
  }

  return result
}

/**
 * Inbox "Última Gestión": most recent linked activity when any exist
 * (seguimientos / gestiones); otherwise the consultation creation timestamp.
 */
export function resolveConsultationLastManagementAt(input: {
  createdAt: string
  lastSeguimientoAt?: string | null
}): string {
  const seguimientoAt = input.lastSeguimientoAt?.trim()
  if (seguimientoAt) {
    return seguimientoAt
  }

  return input.createdAt
}

/** Inbox date columns: dd/MM/yyyy HH:mm (single line, local time). */
export function formatConsultationInboxDateTime(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

const EVENT_ACTION_LABELS: Record<CustomerAtencionEventActionType, string> = {
  consulta_creada: "Creación de la consulta",
  gestion_iniciada: "Inicio de gestión",
  gestion_registrada: "Registro de gestión",
  consulta_pendiente: "Consulta pendiente / devolución",
  consulta_resuelta: "Resolución",
  proximo_paso_cambiado: "Cambio de próximo paso",
  consulta_ot_vinculada: "Vinculación con OT",
  gestion_liberada_por_inactividad: "Gestión liberada por inactividad",
  interaccion_registrada: "Interacción registrada",
}

export function formatCustomerAtencionEventActionLabel(
  actionType: CustomerAtencionEventActionType
): string {
  return EVENT_ACTION_LABELS[actionType] ?? actionType
}

export const CUSTOMER_ATENCION_CHANNEL_OPTIONS = (
  Object.entries(CHANNEL_LABELS) as [CustomerAtencionChannel, string][]
).map(([value, label]) => ({ value, label }))

export const CUSTOMER_ATENCION_MOTIVO_OPTIONS = CUSTOMER_ATENCION_MOTIVO_ORDER.map(
  (value) => ({
    value,
    label: MOTIVO_LABELS[value],
  })
)

export const CUSTOMER_ATENCION_NEXT_STEP_OPTIONS =
  CUSTOMER_ATENCION_NEXT_STEP_MENU_ORDER.map((value) => ({
    value,
    label: NEXT_STEP_LABELS[value],
  }))
