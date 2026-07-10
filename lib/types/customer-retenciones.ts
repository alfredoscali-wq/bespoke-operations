export type CustomerRetencionStatus =
  | "en_gestion"
  | "pendiente_administracion"
  | "pendiente_retiro"
  | "finalizada"

export type CustomerRetencionResultado =
  | "retenido"
  | "persiste_baja"
  | "no_retenido"

export type CustomerRetencionMotivoBaja =
  | "precio_situacion_economica"
  | "problemas_tecnicos"
  | "problemas_reiterados_sin_solucion"
  | "mala_atencion"
  | "falta_de_respuesta"
  | "cambio_de_proveedor"
  | "mudanza"
  | "ya_no_necesita_servicio"
  | "otro"

export interface CustomerRetencion {
  id: string
  companyId: string
  customerId: string
  assignedEmployeeId: string
  assignedByEmployeeId: string
  motivoBaja: CustomerRetencionMotivoBaja
  detail: string
  status: CustomerRetencionStatus
  resultado?: CustomerRetencionResultado | null
  resolution?: string | null
  completedAt?: string | null
  completedByEmployeeId?: string | null
  administrationPendingAt?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type CustomerRetencionActiveRow = Pick<
  CustomerRetencion,
  | "id"
  | "customerId"
  | "motivoBaja"
  | "detail"
  | "createdAt"
  | "assignedByEmployeeId"
  | "status"
  | "resultado"
  | "resolution"
> & {
  customerName: string
  assignedByEmployeeName: string
}

export type NewCustomerRetencionInput = {
  customerId: string
  motivoBaja: CustomerRetencionMotivoBaja
  detail: string
}

export type ResolveCustomerRetencionInput = {
  resultado: "retenido" | "persiste_baja"
  resolution: string
}

export type CustomerRetencionJornadaRow = {
  id: string
  kind: "retencion"
  occurredAt: string
  customerId: string
  customerName: string
  resultado: CustomerRetencionResultado
  resolution: string
}

export type AtencionClienteAssigneeOption = {
  id: string
  displayName: string
}

export type CustomerRetencionSupervisionRow = Pick<
  CustomerRetencion,
  | "id"
  | "customerId"
  | "assignedEmployeeId"
  | "assignedByEmployeeId"
  | "motivoBaja"
  | "detail"
  | "status"
  | "resultado"
  | "resolution"
  | "completedAt"
  | "createdAt"
  | "administrationPendingAt"
> & {
  customerName: string
  assignedEmployeeName: string
  assignedByEmployeeName: string
}
