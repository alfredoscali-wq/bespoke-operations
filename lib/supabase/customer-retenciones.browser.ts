import { createClient } from "@/lib/supabase/client"
import {
  countActiveRetencionesForEmployee,
  deriveCustomerRetencionToAdministration as deriveCustomerRetencionToAdministrationQuery,
  fetchActiveRetencionesForEmployee,
  fetchAssignedRetencionesForCompany,
  fetchAtencionClienteAssignees,
  fetchCustomerRetencionById,
  fetchRetencionJornadaRowsForEmployeeToday,
  finalizeCustomerRetencionRetained,
  insertCustomerRetencion,
  markCustomerRetencionReadyForRetiro as markCustomerRetencionReadyForRetiroQuery,
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
  DeriveCustomerRetencionToAdministrationPayload,
  FinalizeCustomerRetencionRetainedPayload,
  MarkCustomerRetencionReadyForRetiroPayload,
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

export async function listActiveRetencionesForEmployee(
  companyId: string,
  employeeId: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionActiveRow[]>> {
  return fetchActiveRetencionesForEmployee(client, companyId, employeeId)
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

export async function finalizeRetainedCustomerRetencion(
  id: string,
  payload: FinalizeCustomerRetencionRetainedPayload,
  companyId?: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  return finalizeCustomerRetencionRetained(client, id, payload, companyId)
}

export async function deriveCustomerRetencionToAdministration(
  id: string,
  payload: DeriveCustomerRetencionToAdministrationPayload,
  companyId?: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  return deriveCustomerRetencionToAdministrationQuery(
    client,
    id,
    payload,
    companyId
  )
}

export async function markCustomerRetencionReadyForRetiro(
  id: string,
  payload: MarkCustomerRetencionReadyForRetiroPayload,
  companyId?: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  return markCustomerRetencionReadyForRetiroQuery(
    client,
    id,
    payload,
    companyId
  )
}

export async function getActiveRetencionesCount(
  companyId: string,
  employeeId: string,
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<number>> {
  return countActiveRetencionesForEmployee(client, companyId, employeeId)
}

export async function listRetencionJornadaRowsForEmployeeToday(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerRetencionesClient = createBrowserCustomerRetencionesClient()
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionJornadaRow[]>> {
  return fetchRetencionJornadaRowsForEmployeeToday(
    client,
    companyId,
    employeeId,
    referenceDate
  )
}
