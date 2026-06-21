import { createClient } from "@/lib/supabase/client"
import {
  createCustomer as insertCustomer,
  deleteCustomer as removeCustomer,
  getCustomers as fetchCustomers,
  searchCustomers as querySearchCustomers,
  updateCustomer as patchCustomer,
  type SupabaseCustomersClient,
} from "@/lib/supabase/customers.queries"
import type { Customer } from "@/lib/types/customers"
import type {
  CreateCustomerPayload,
  CustomersRepositoryResult,
  UpdateCustomerPayload,
} from "@/lib/types/supabase/customers"

export function createBrowserCustomersClient(): SupabaseCustomersClient {
  return createClient()
}

export async function getCustomers(
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<Customer[]>> {
  return fetchCustomers(client)
}

export async function searchCustomers(
  query: string,
  limit = 8,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<Customer[]>> {
  return querySearchCustomers(client, query, limit)
}

export async function createCustomer(
  payload: Omit<CreateCustomerPayload, "customerNumber"> & {
    customerNumber?: string
  },
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<Customer>> {
  return insertCustomer(client, payload)
}

export async function updateCustomer(
  id: string,
  payload: UpdateCustomerPayload,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<Customer>> {
  return patchCustomer(client, id, payload)
}

export async function deleteCustomer(
  id: string,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<void>> {
  return removeCustomer(client, id)
}
