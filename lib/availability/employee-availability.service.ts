import { getCurrentAvailabilityStatus as resolveCurrentAvailabilityStatus } from "@/lib/availability/utils"
import { BESPOKE_DEMO_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  createBrowserEmployeeAvailabilityClient,
  createEmployeeAvailabilityRecord,
  deleteEmployeeAvailabilityRecord,
  getActiveAvailabilityByEmployee as fetchActiveAvailabilityByEmployeeFromDb,
  getEmployeeAvailabilityById as fetchEmployeeAvailabilityByIdFromDb,
  listEmployeeAvailabilities,
  updateEmployeeAvailabilityRecord,
} from "@/lib/supabase/employee-availability.browser"
import type {
  AvailabilityType,
  CreateEmployeeAvailabilityInput,
  EmployeeAvailability,
  UpdateEmployeeAvailabilityInput,
} from "@/lib/types/availability"
import type {
  CreateEmployeeAvailabilityPayload,
  EmployeeAvailabilityRepositoryResult,
  UpdateEmployeeAvailabilityPayload,
} from "@/lib/types/supabase/availability"

export type EmployeeAvailabilityServiceClient = ReturnType<
  typeof createBrowserEmployeeAvailabilityClient
>

function mapCreateInputToPayload(
  input: CreateEmployeeAvailabilityInput
): CreateEmployeeAvailabilityPayload {
  return {
    companyId: BESPOKE_DEMO_COMPANY_ID,
    employeeId: input.employeeId,
    startDate: input.startDate,
    endDate: input.endDate,
    availabilityType: input.availabilityType,
    reason: input.reason ?? null,
  }
}

function mapUpdateInputToPayload(
  input: UpdateEmployeeAvailabilityInput
): UpdateEmployeeAvailabilityPayload {
  return {
    ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.availabilityType !== undefined
      ? { availabilityType: input.availabilityType }
      : {}),
    ...(input.reason !== undefined ? { reason: input.reason ?? null } : {}),
  }
}

export async function getEmployeeAvailabilities(
  client?: EmployeeAvailabilityServiceClient
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability[]>> {
  return listEmployeeAvailabilities(
    client ?? createBrowserEmployeeAvailabilityClient()
  )
}

export async function getEmployeeAvailabilityById(
  id: string,
  client?: EmployeeAvailabilityServiceClient
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  return fetchEmployeeAvailabilityByIdFromDb(
    id,
    client ?? createBrowserEmployeeAvailabilityClient()
  )
}

export async function createEmployeeAvailability(
  input: CreateEmployeeAvailabilityInput,
  client?: EmployeeAvailabilityServiceClient
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  return createEmployeeAvailabilityRecord(
    mapCreateInputToPayload(input),
    client ?? createBrowserEmployeeAvailabilityClient()
  )
}

export async function updateEmployeeAvailability(
  id: string,
  input: UpdateEmployeeAvailabilityInput,
  client?: EmployeeAvailabilityServiceClient
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  return updateEmployeeAvailabilityRecord(
    id,
    mapUpdateInputToPayload(input),
    client ?? createBrowserEmployeeAvailabilityClient()
  )
}

export async function softDeleteEmployeeAvailability(
  id: string,
  client?: EmployeeAvailabilityServiceClient
): Promise<EmployeeAvailabilityRepositoryResult<void>> {
  return deleteEmployeeAvailabilityRecord(
    id,
    client ?? createBrowserEmployeeAvailabilityClient()
  )
}

export async function getActiveAvailabilityByEmployee(
  employeeId: string,
  referenceDate?: string,
  client?: EmployeeAvailabilityServiceClient
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability[]>> {
  const date = referenceDate ?? new Date().toISOString().slice(0, 10)
  return fetchActiveAvailabilityByEmployeeFromDb(
    employeeId,
    date,
    client ?? createBrowserEmployeeAvailabilityClient()
  )
}

export function getCurrentAvailabilityStatus(
  employeeId: string,
  records: EmployeeAvailability[],
  referenceDate?: string
): AvailabilityType {
  return resolveCurrentAvailabilityStatus(employeeId, records, referenceDate)
}

export { createBrowserEmployeeAvailabilityClient }
