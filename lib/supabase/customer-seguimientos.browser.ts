import { createClient } from "@/lib/supabase/client"
import {
  completeCustomerSeguimiento,
  fetchAtencionClienteKpiSummary,
  fetchCompletedSeguimientosForEmployeeToday,
  fetchPendingSeguimientosForEmployee,
  fetchSeguimientoById,
  insertCustomerSeguimiento,
  type SupabaseCustomerSeguimientosClient,
} from "@/lib/supabase/customer-seguimientos.queries"
import type { AtencionClienteKpiSummary } from "@/lib/customer-seguimientos/kpis"
import type {
  CustomerSeguimiento,
  CustomerSeguimientoAgendaRow,
  CustomerSeguimientoJornadaRow,
} from "@/lib/types/customer-seguimientos"
import type {
  CreateCustomerSeguimientoPayload,
  CustomerSeguimientosRepositoryResult,
  UpdateCustomerSeguimientoCompletePayload,
} from "@/lib/types/supabase/customer-seguimientos"

export function createBrowserCustomerSeguimientosClient(): SupabaseCustomerSeguimientosClient {
  return createClient()
}

export async function listPendingSeguimientosForEmployee(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerSeguimientosClient = createBrowserCustomerSeguimientosClient()
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimientoAgendaRow[]>> {
  return fetchPendingSeguimientosForEmployee(
    client,
    companyId,
    employeeId,
    referenceDate
  )
}

export async function getCustomerSeguimientoById(
  id: string,
  companyId?: string,
  client: SupabaseCustomerSeguimientosClient = createBrowserCustomerSeguimientosClient()
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimiento>> {
  return fetchSeguimientoById(client, id, companyId)
}

export async function createCustomerSeguimiento(
  payload: CreateCustomerSeguimientoPayload,
  client: SupabaseCustomerSeguimientosClient = createBrowserCustomerSeguimientosClient()
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimiento>> {
  return insertCustomerSeguimiento(client, payload)
}

export async function markCustomerSeguimientoCompleted(
  id: string,
  payload: UpdateCustomerSeguimientoCompletePayload,
  companyId?: string,
  client: SupabaseCustomerSeguimientosClient = createBrowserCustomerSeguimientosClient()
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimiento>> {
  return completeCustomerSeguimiento(client, id, payload, companyId)
}

export async function getAtencionClienteDashboardSummary(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerSeguimientosClient = createBrowserCustomerSeguimientosClient()
): Promise<CustomerSeguimientosRepositoryResult<AtencionClienteKpiSummary>> {
  return fetchAtencionClienteKpiSummary(
    client,
    companyId,
    employeeId,
    referenceDate
  )
}

export async function listCompletedSeguimientosToday(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerSeguimientosClient = createBrowserCustomerSeguimientosClient()
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimientoJornadaRow[]>> {
  return fetchCompletedSeguimientosForEmployeeToday(
    client,
    companyId,
    employeeId,
    referenceDate
  )
}
