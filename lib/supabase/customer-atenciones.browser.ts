import { createClient } from "@/lib/supabase/client"
import {
  fetchCustomerAtencionById,
  insertCustomerAtencion,
  listCustomerAtencionesPaginated,
  type SupabaseCustomerAtencionesClient,
} from "@/lib/supabase/customer-atenciones.queries"
import type { CustomerAtencionListQuery } from "@/lib/customer-atenciones/atencion-list"
import type {
  CustomerAtencion,
  CustomerAtencionListPage,
} from "@/lib/types/customer-atenciones"
import type {
  CreateCustomerAtencionPayload,
  CustomerAtencionesRepositoryResult,
} from "@/lib/types/supabase/customer-atenciones"

export function createBrowserCustomerAtencionesClient(): SupabaseCustomerAtencionesClient {
  return createClient()
}

export async function listAtencionPage(
  companyId: string,
  query: CustomerAtencionListQuery,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencionListPage>> {
  return listCustomerAtencionesPaginated(client, companyId, query)
}

export async function getCustomerAtencionById(
  id: string,
  companyId?: string,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencion>> {
  return fetchCustomerAtencionById(client, id, companyId)
}

export async function createCustomerAtencion(
  payload: CreateCustomerAtencionPayload,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencion>> {
  return insertCustomerAtencion(client, payload)
}
