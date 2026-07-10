import type {
  CustomerRetencionMotivoBaja,
  CustomerRetencionResultado,
  CustomerRetencionStatus,
} from "@/lib/types/customer-retenciones"

export type CreateCustomerRetencionPayload = {
  companyId: string
  customerId: string
  assignedEmployeeId: string
  assignedByEmployeeId: string
  motivoBaja: CustomerRetencionMotivoBaja
  detail: string
}

export type FinalizeCustomerRetencionRetainedPayload = {
  status: "finalizada"
  resultado: "retenido"
  resolution: string
  completedAt: string
  completedByEmployeeId: string
}

export type DeriveCustomerRetencionToAdministrationPayload = {
  status: "pendiente_administracion"
  resultado: "persiste_baja"
  resolution: string
  administrationPendingAt: string
}

export type MarkCustomerRetencionReadyForRetiroPayload = {
  status: "pendiente_retiro"
}

export type CustomerRetencionesRepositoryErrorCode =
  | "VALIDATION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNKNOWN"

export type CustomerRetencionesRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CustomerRetencionesRepositoryErrorCode
        message: string
      }
    }

export type { CustomerRetencionStatus, CustomerRetencionResultado }
