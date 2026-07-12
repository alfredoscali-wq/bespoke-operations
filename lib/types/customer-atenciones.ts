export type CustomerAtencionChannel =
  | "telefono"
  | "whatsapp"
  | "presencial"
  | "otro"

export type CustomerAtencionMotivo =
  | "consulta"
  | "reclamo"
  | "solicitud"
  | "problema_tecnico"
  | "facturacion"
  | "baja"
  | "retencion"
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

export type CustomerAtencionNextStep =
  | "realizar_retencion"
  | "resolver_facturacion"
  | "analizar_problema_tecnico"
  | "contactar_cliente"
  | "esperar_cliente"
  | "esperar_administracion"
  | "coordinar_retiro"
  | "generar_ot"

/** Sprint 1.0 default; Sprint 2.0 allows `requiere_seguimiento` on create. */
export const CUSTOMER_ATENCION_DEFAULT_RESULTADO: CustomerAtencionResultado =
  "resuelta"

/** @deprecated Use CUSTOMER_ATENCION_DEFAULT_RESULTADO */
export const CUSTOMER_ATENCION_SPRINT_1_0_RESULTADO =
  CUSTOMER_ATENCION_DEFAULT_RESULTADO

export type NewCustomerAtencionSeguimientoInput = {
  scheduledDate: string
  scheduledTime?: string | null
  observation: string
}

export type NewCustomerAtencionInput = {
  customerId: string
  channel: CustomerAtencionChannel
  motivo: CustomerAtencionMotivo
  detail: string
  resolution: string
  resultado?: CustomerAtencionResultado
  seguimiento?: NewCustomerAtencionSeguimientoInput
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

export type CustomerAtencionListPage = {
  items: CustomerAtencionListRow[]
  total: number
  page: number
  pageSize: number
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
  | "createdAt"
  | "updatedAt"
> & {
  customerName: string
  attendedByEmployeeName: string
  activeManagementEmployeeName?: string | null
}
