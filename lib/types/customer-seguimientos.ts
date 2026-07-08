export type CustomerSeguimientoStatus = "pendiente" | "completado"

export interface CustomerSeguimiento {
  id: string
  companyId: string
  customerId: string
  sourceAtencionId?: string | null
  previousSeguimientoId?: string | null
  assignedEmployeeId: string
  scheduledDate: string
  scheduledTime?: string | null
  observation: string
  status: CustomerSeguimientoStatus
  completionAction?: string | null
  completedAt?: string | null
  completedByEmployeeId?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type CustomerSeguimientoAgendaRow = Pick<
  CustomerSeguimiento,
  | "id"
  | "customerId"
  | "sourceAtencionId"
  | "scheduledDate"
  | "scheduledTime"
  | "observation"
  | "status"
> & {
  customerName: string
  isOverdue: boolean
}

export type NewCustomerSeguimientoInput = {
  customerId: string
  sourceAtencionId?: string | null
  previousSeguimientoId?: string | null
  scheduledDate: string
  scheduledTime?: string | null
  observation: string
}

export type CompleteCustomerSeguimientoInput = {
  completionAction: string
}

export type CompleteCustomerSeguimientoWithFollowUpInput = {
  completionAction: string
  nextScheduledDate: string
  nextScheduledTime?: string | null
  nextObservation: string
}

export type CustomerSeguimientoJornadaRow = {
  id: string
  kind: "seguimiento"
  completedAt: string
  customerId: string
  customerName: string
  completionAction: string
  sourceAtencionId?: string | null
}
