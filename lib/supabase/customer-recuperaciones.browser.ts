import { createClient } from "@/lib/supabase/client"
import {
  countRecuperacionesForEmployeeToday,
  fetchCustomerRecuperacionById,
  fetchRecuperacionesForEmployee,
  fetchRecuperacionesForEmployeeInRange,
  getRecuperacionDayBoundsIso,
  insertCustomerRecuperacion,
  type SupabaseCustomerRecuperacionesClient,
} from "@/lib/supabase/customer-recuperaciones.queries"
import type {
  CustomerRecuperacion,
  CustomerRecuperacionActivityRow,
  CustomerRecuperacionJornadaRow,
} from "@/lib/types/customer-recuperaciones"
import type {
  CreateCustomerRecuperacionPayload,
  CustomerRecuperacionesRepositoryResult,
} from "@/lib/types/supabase/customer-recuperaciones"

export function createBrowserCustomerRecuperacionesClient(): SupabaseCustomerRecuperacionesClient {
  return createClient()
}

export async function listRecuperacionesForEmployee(
  companyId: string,
  employeeId: string,
  client: SupabaseCustomerRecuperacionesClient = createBrowserCustomerRecuperacionesClient()
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacionActivityRow[]>> {
  return fetchRecuperacionesForEmployee(client, companyId, employeeId)
}

export async function listRecuperacionesTodayForEmployee(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerRecuperacionesClient = createBrowserCustomerRecuperacionesClient()
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacionJornadaRow[]>> {
  const bounds = getRecuperacionDayBoundsIso(referenceDate)

  return fetchRecuperacionesForEmployeeInRange(
    client,
    companyId,
    employeeId,
    bounds
  )
}

export async function listRecuperacionesInRangeForEmployee(
  companyId: string,
  employeeId: string,
  bounds: { start: string; end: string },
  client: SupabaseCustomerRecuperacionesClient = createBrowserCustomerRecuperacionesClient()
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacionJornadaRow[]>> {
  return fetchRecuperacionesForEmployeeInRange(
    client,
    companyId,
    employeeId,
    bounds
  )
}

export async function getRecuperacionesTodayCount(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerRecuperacionesClient = createBrowserCustomerRecuperacionesClient()
): Promise<CustomerRecuperacionesRepositoryResult<number>> {
  return countRecuperacionesForEmployeeToday(
    client,
    companyId,
    employeeId,
    referenceDate
  )
}

export async function getCustomerRecuperacionById(
  id: string,
  companyId?: string,
  client: SupabaseCustomerRecuperacionesClient = createBrowserCustomerRecuperacionesClient()
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacion>> {
  return fetchCustomerRecuperacionById(client, id, companyId)
}

export async function createCustomerRecuperacion(
  payload: CreateCustomerRecuperacionPayload,
  client: SupabaseCustomerRecuperacionesClient = createBrowserCustomerRecuperacionesClient()
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacion>> {
  return insertCustomerRecuperacion(client, payload)
}
