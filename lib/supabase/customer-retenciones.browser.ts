import { createClient } from "@/lib/supabase/client"
import {
  completeCustomerRetencion,
  countActiveRetencionesForEmployee,
  fetchAssignedRetencionesForCompany,
  fetchAtencionClienteAssignees,
  fetchCompletedRetencionesToday,
  fetchCustomerRetencionById,
  fetchPendingRetencionesForEmployee,
  insertCustomerRetencion,
  type SupabaseCustomerRetencionesClient,
} from "@/lib/supabase/customer-retenciones.queries"
import type {
  AtencionClienteAssigneeOption,
  CustomerRetencion,
  CustomerRetencionActiveRow,
  CustomerRetencionJornadaRow,
  CustomerRetencionSupervisionRow,
} from "@/lib/types/customer-retenciones"
import type {
  CreateCustomerRetencionPayload,
  CustomerRetencionesRepositoryResult,
  UpdateCustomerRetencionCompletePayload,
} from "@/lib/types/supabase/customer-retenciones"

export function createBrowserCustomerRetencionesClient(): SupabaseCustomerRetencionesClient {
  return createClient()
}

export async function listAtencionClienteAssignees(
  companyId: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<AtencionClienteAssigneeOption[]>> {
  return fetchAtencionClienteAssignees(client, companyId)
}

export async function listPendingRetencionesForEmployee(
  companyId: string,
  employeeId: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionActiveRow[]>> {
  return fetchPendingRetencionesForEmployee(client, companyId, employeeId)
}

export async function listAssignedRetencionesForCompany(
  companyId: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionSupervisionRow[]>> {
  return fetchAssignedRetencionesForCompany(client, companyId)
}

export async function getCustomerRetencionById(
  id: string,
  companyId?: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  return fetchCustomerRetencionById(client, id, companyId)
}

export async function createCustomerRetencion(
  payload: CreateCustomerRetencionPayload,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  return insertCustomerRetencion(client, payload)
}

export async function markCustomerRetencionCompleted(
  id: string,
  payload: UpdateCustomerRetencionCompletePayload,
  companyId?: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  return completeCustomerRetencion(client, id, payload, companyId)
}

export async function getActiveRetencionesCount(
  companyId: string,
  employeeId: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<number>> {
  return countActiveRetencionesForEmployee(client, companyId, employeeId)
}

export async function listCompletedRetencionesToday(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionJornadaRow[]>> {
  return fetchCompletedRetencionesToday(
    client,
    companyId,
    employeeId,
    referenceDate
  )
}
