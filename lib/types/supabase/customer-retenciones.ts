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

export type UpdateCustomerRetencionCompletePayload = {
  status: CustomerRetencionStatus
  resultado: CustomerRetencionResultado
  resolution: string
  completedAt: string
  completedByEmployeeId: string
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
