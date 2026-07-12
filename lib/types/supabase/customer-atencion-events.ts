import type {
  CustomerAtencionEventActionType,
  CustomerAtencionEvent,
} from "@/lib/types/customer-atencion-events"
import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

export type CreateCustomerAtencionEventPayload = {
  companyId: string
  customerAtencionId: string
  employeeId: string
  actionType: CustomerAtencionEventActionType
  detail?: string | null
  previousStatus?: CustomerAtencionStatus | null
  newStatus?: CustomerAtencionStatus | null
  previousNextStep?: CustomerAtencionNextStep | null
  newNextStep?: CustomerAtencionNextStep | null
}

export type CustomerAtencionEventsRepositoryErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "FORBIDDEN"
  | "UNKNOWN"

export type CustomerAtencionEventsRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CustomerAtencionEventsRepositoryErrorCode
        message: string
      }
    }

export type { CustomerAtencionEvent }
