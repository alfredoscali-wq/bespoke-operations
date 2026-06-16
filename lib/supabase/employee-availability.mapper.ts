import type {
  EmployeeAvailabilityInsert,
  EmployeeAvailabilityRow,
  EmployeeAvailabilityUpdate,
} from "@/lib/supabase/database.types"
import type { AvailabilityType, EmployeeAvailability } from "@/lib/types/availability"
import type {
  CreateEmployeeAvailabilityPayload,
  UpdateEmployeeAvailabilityPayload,
} from "@/lib/types/supabase/availability"

function trimOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export function mapEmployeeAvailabilityRowToEmployeeAvailability(
  row: EmployeeAvailabilityRow
): EmployeeAvailability {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    startDate: row.start_date,
    endDate: row.end_date,
    availabilityType: row.availability_type as AvailabilityType,
    reason: row.reason ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

export function mapCreateEmployeeAvailabilityPayloadToInsert(
  payload: CreateEmployeeAvailabilityPayload
): EmployeeAvailabilityInsert {
  return {
    company_id: payload.companyId,
    employee_id: payload.employeeId,
    start_date: payload.startDate,
    end_date: payload.endDate,
    availability_type: payload.availabilityType,
    reason: trimOptional(payload.reason),
  }
}

export function mapUpdateEmployeeAvailabilityPayloadToUpdate(
  payload: UpdateEmployeeAvailabilityPayload
): EmployeeAvailabilityUpdate {
  const update: EmployeeAvailabilityUpdate = {}

  if (payload.employeeId !== undefined) {
    update.employee_id = payload.employeeId
  }
  if (payload.startDate !== undefined) {
    update.start_date = payload.startDate
  }
  if (payload.endDate !== undefined) {
    update.end_date = payload.endDate
  }
  if (payload.availabilityType !== undefined) {
    update.availability_type = payload.availabilityType
  }
  if (payload.reason !== undefined) {
    update.reason = trimOptional(payload.reason)
  }

  return update
}
