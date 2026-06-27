import { createClient } from "@/lib/supabase/client"
import {
  fetchActiveAvailabilityByEmployee,
  fetchEmployeeAvailabilities,
  fetchEmployeeAvailabilityById,
  insertEmployeeAvailability,
  patchEmployeeAvailability,
  softDeleteEmployeeAvailabilityRecord,
  type SupabaseEmployeeAvailabilityClient,
} from "@/lib/supabase/employee-availability.queries"
import type { EmployeeAvailability } from "@/lib/types/availability"
import type {
  CreateEmployeeAvailabilityPayload,
  EmployeeAvailabilityRepositoryResult,
  UpdateEmployeeAvailabilityPayload,
} from "@/lib/types/supabase/availability"

export function createBrowserEmployeeAvailabilityClient(): SupabaseEmployeeAvailabilityClient {
  return createClient()
}

export async function listEmployeeAvailabilities(
  companyId: string,
  client: SupabaseEmployeeAvailabilityClient = createBrowserEmployeeAvailabilityClient()
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability[]>> {
  return fetchEmployeeAvailabilities(client, companyId)
}

export async function getEmployeeAvailabilityById(
  id: string,
  client: SupabaseEmployeeAvailabilityClient = createBrowserEmployeeAvailabilityClient()
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  return fetchEmployeeAvailabilityById(client, id)
}

export async function getActiveAvailabilityByEmployee(
  employeeId: string,
  referenceDate: string,
  client: SupabaseEmployeeAvailabilityClient = createBrowserEmployeeAvailabilityClient()
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability[]>> {
  return fetchActiveAvailabilityByEmployee(client, employeeId, referenceDate)
}

export async function createEmployeeAvailabilityRecord(
  payload: CreateEmployeeAvailabilityPayload,
  client: SupabaseEmployeeAvailabilityClient = createBrowserEmployeeAvailabilityClient()
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  return insertEmployeeAvailability(client, payload)
}

export async function updateEmployeeAvailabilityRecord(
  id: string,
  payload: UpdateEmployeeAvailabilityPayload,
  client: SupabaseEmployeeAvailabilityClient = createBrowserEmployeeAvailabilityClient()
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  return patchEmployeeAvailability(client, id, payload)
}

export async function deleteEmployeeAvailabilityRecord(
  id: string,
  client: SupabaseEmployeeAvailabilityClient = createBrowserEmployeeAvailabilityClient()
): Promise<EmployeeAvailabilityRepositoryResult<void>> {
  return softDeleteEmployeeAvailabilityRecord(client, id)
}
