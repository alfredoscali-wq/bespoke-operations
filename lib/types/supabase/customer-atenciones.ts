import type {
  CustomerAtencionChannel,
  CustomerAtencionMotivo,
} from "@/lib/types/customer-atenciones"

export type CreateCustomerAtencionPayload = {
  companyId: string
  customerId: string
  attendedByEmployeeId: string
  channel: CustomerAtencionChannel
  motivo: CustomerAtencionMotivo
  detail: string
  resolution: string
}

export type CustomerAtencionesRepositoryErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "FORBIDDEN"
  | "UNKNOWN"

export type CustomerAtencionesRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CustomerAtencionesRepositoryErrorCode
        message: string
      }
    }
