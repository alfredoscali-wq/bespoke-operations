export type AvailabilityType =
  | "AVAILABLE"
  | "VACATION"
  | "SICK_LEAVE"
  | "TRAINING"
  | "LICENSE"
  | "OTHER"

export type EmployeeAvailability = {
  id: string
  companyId: string
  employeeId: string
  startDate: string
  endDate: string
  availabilityType: AvailabilityType
  reason?: string
  createdAt?: string
  updatedAt?: string
}

export type EmployeeAvailabilityListItem = EmployeeAvailability & {
  employeeName: string
  employeeCode: string
  periodStatus: AvailabilityPeriodStatus
}

export type AvailabilityPeriodStatus = "active" | "scheduled" | "finished"

export type AvailabilitySummary = {
  available: number
  vacation: number
  licenses: number
  training: number
  total: number
}

export type CreateEmployeeAvailabilityInput = {
  employeeId: string
  startDate: string
  endDate: string
  availabilityType: AvailabilityType
  reason?: string
}

export type UpdateEmployeeAvailabilityInput = Partial<CreateEmployeeAvailabilityInput>
