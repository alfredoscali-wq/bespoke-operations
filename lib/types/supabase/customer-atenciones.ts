import type {
  CustomerAtencionChannel,
  CustomerAtencionMotivo,
  CustomerAtencionResultado,
} from "@/lib/types/customer-atenciones"

export type CreateCustomerAtencionPayload = {
  companyId: string
  customerId: string
  attendedByEmployeeId: string
  channel: CustomerAtencionChannel
  motivo: CustomerAtencionMotivo
  detail: string
  resolution: string
  resultado?: CustomerAtencionResultado
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
