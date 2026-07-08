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

/** Sprint 1.0: único resultado permitido al registrar una atención. */
export const CUSTOMER_ATENCION_SPRINT_1_0_RESULTADO: CustomerAtencionResultado =
  "resuelta"

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

export type NewCustomerAtencionInput = {
  customerId: string
  channel: CustomerAtencionChannel
  motivo: CustomerAtencionMotivo
  detail: string
  resolution: string
}
