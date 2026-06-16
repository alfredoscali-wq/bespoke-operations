import type { AvailabilityType } from "@/lib/types/availability"

export type CreateEmployeeAvailabilityPayload = {
  companyId?: string
  employeeId: string
  startDate: string
  endDate: string
  availabilityType: AvailabilityType
  reason?: string | null
}

export type UpdateEmployeeAvailabilityPayload = Partial<{
  employeeId: string
  startDate: string
  endDate: string
  availabilityType: AvailabilityType
  reason: string | null
}>

export type EmployeeAvailabilityRepositoryErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNKNOWN"

export type EmployeeAvailabilityRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: EmployeeAvailabilityRepositoryErrorCode
        message: string
      }
    }
