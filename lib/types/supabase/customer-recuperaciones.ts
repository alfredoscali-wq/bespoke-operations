import type {
  CustomerRecuperacionChannel,
  CustomerRecuperacionResultado,
} from "@/lib/types/customer-recuperaciones"

export type CreateCustomerRecuperacionPayload = {
  companyId: string
  customerId?: string | null
  manualCustomerName?: string | null
  manualZone?: string | null
  manualPhone?: string | null
  performedByEmployeeId: string
  channel: CustomerRecuperacionChannel
  offer: string
  observation: string
  resultado: CustomerRecuperacionResultado
}

export type CustomerRecuperacionesRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: "VALIDATION" | "FORBIDDEN" | "NOT_FOUND" | "UNKNOWN"
        message: string
      }
    }
