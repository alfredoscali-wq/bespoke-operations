import type { QuickCustomerInput } from "@/lib/types/customers"
import type { ConsultationFollowUpAction } from "@/lib/customer-atenciones/consultation-follow-up"

export type { ConsultationFollowUpAction }

export type CustomerAtencionChannel =
  | "telefono"
  | "whatsapp"
  | "presencial"
  | "otro"

export type CustomerAtencionMotivo =
  | "problema_tecnico"
  | "facturacion"
  | "cambio_plan_tecnologia"
  | "consulta_comercial"
  | "consulta_tv"
  | "nuevo_servicio"
  | "baja"
  | "otro"

export type CustomerAtencionResultado =
  | "resuelta"
  | "requiere_seguimiento"
  | "ot_creada"

export type CustomerAtencionStatus =
  | "nueva"
  | "para_resolver"
  | "en_gestion"
  | "pendiente"
  | "resuelta"

/**
 * Sprint 2.8 — next step encodes the pending action, not the owning area.
 * External wait: esperar_cliente only → status pendiente.
 */
export type CustomerAtencionNextStep =
  | "realizar_retencion"
  | "resolver_consulta_tecnica"
  | "derivar_admin_facturacion"
  | "derivar_admin_morosos"
  | "derivar_admin_gestion"
  | "contactar_cliente"
  | "seguimiento_cliente"
  | "esperar_cliente"
  | "generar_ot"

export type MorosoTrackingStatus =
  | "cupon_pendiente_enviar"
  | "cupon_enviado"
  | "esperando_acreditacion"
  | "pago_acreditado"
  | "servicio_rehabilitado"

/** Sprint 1.0 default; Sprint 2.0 allows `requiere_seguimiento` on create. */
export const CUSTOMER_ATENCION_DEFAULT_RESULTADO: CustomerAtencionResultado =
  "resuelta"

/** @deprecated Use CUSTOMER_ATENCION_DEFAULT_RESULTADO */
export const CUSTOMER_ATENCION_SPRINT_1_0_RESULTADO =
  CUSTOMER_ATENCION_DEFAULT_RESULTADO

export type NewConsultationDecision = "resolver_ahora" | "continuar_gestion"

export type NewCustomerAtencionSeguimientoInput = {
  scheduledDate: string
  scheduledTime?: string | null
  observation: string
}

export type NewCustomerAtencionInput = {
  customerId?: string
  quickCustomer?: QuickCustomerInput
  channel: CustomerAtencionChannel
  motivo: CustomerAtencionMotivo
  detail: string
  decision: NewConsultationDecision
  resolution?: string
  nextStep?: CustomerAtencionNextStep
}

export interface CustomerAtencion {
  id: string
  companyId: string
  customerId: string
  attendedByEmployeeId: string
  channel: CustomerAtencionChannel
  motivo: CustomerAtencionMotivo
  detail: string
  resolution: string
  resultado: CustomerAtencionResultado
  status: CustomerAtencionStatus
  nextStep?: CustomerAtencionNextStep | null
  activeManagementEmployeeId?: string | null
  activeManagementStartedAt?: string | null
  /** RC 3.2.5 — last activity while holding the exclusive lock. */
  activeManagementLastActivityAt?: string | null
  morosoTrackingStatus?: MorosoTrackingStatus | null
  linkedTaskId?: string | null
  linkedTaskCode?: string | null
  otLinkedAt?: string | null
  otLinkedByEmployeeId?: string | null
  /** RC 3.2.0 — post-resolution actions (e.g. generar_ot). Not next_step. */
  followUpActions?: ConsultationFollowUpAction[]
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type CustomerAtencionListRow = Pick<
  CustomerAtencion,
  | "id"
  | "customerId"
  | "channel"
  | "motivo"
  | "resultado"
  | "createdAt"
  | "attendedByEmployeeId"
> & {
  customerName: string
}

export type CustomerAtencionInboxRow = Pick<
  CustomerAtencion,
  | "id"
  | "customerId"
  | "channel"
  | "motivo"
  | "detail"
  | "status"
  | "nextStep"
  | "attendedByEmployeeId"
  | "activeManagementEmployeeId"
  | "activeManagementStartedAt"
  | "activeManagementLastActivityAt"
  | "linkedTaskId"
  | "linkedTaskCode"
  | "followUpActions"
  | "createdAt"
  | "updatedAt"
> & {
  customerName: string
  attendedByEmployeeName: string
  activeManagementEmployeeName?: string | null
}

export type CustomerAtencionListPage = {
  items: CustomerAtencionListRow[]
  total: number
  page: number
  pageSize: number
}
