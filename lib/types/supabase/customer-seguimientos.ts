import type { NewCustomerSeguimientoInput } from "@/lib/types/customer-seguimientos"

export type CreateCustomerSeguimientoPayload = NewCustomerSeguimientoInput & {
  companyId: string
  assignedEmployeeId: string
}

export type UpdateCustomerSeguimientoCompletePayload = {
  completionAction: string
  completedAt: string
  completedByEmployeeId: string
  status: "completado"
}

export type CustomerSeguimientosRepositoryErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "FORBIDDEN"
  | "UNKNOWN"

export type CustomerSeguimientosRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CustomerSeguimientosRepositoryErrorCode
        message: string
      }
    }
