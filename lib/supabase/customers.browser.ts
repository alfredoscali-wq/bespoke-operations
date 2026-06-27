import { createClient } from "@/lib/supabase/client"
import {
  createCustomer as insertCustomer,
  deleteCustomer as removeCustomer,
  fetchCustomerDuplicateIndex,
  getCustomerById as fetchCustomerById,
  getCustomerOperationalSummaryCounts,
  listCustomersPaginated,
  markCustomersValidated,
  searchCustomers as querySearchCustomers,
  updateCustomer as patchCustomer,
  type SupabaseCustomersClient,
} from "@/lib/supabase/customers.queries"
import { getCustomerOperationalActivity } from "@/lib/customers/customer-activity"
import { canDeleteCustomerWithActivity } from "@/lib/customers/customer-activity"
import type {
  Customer,
  CustomerListPage,
  CustomerListRow,
} from "@/lib/types/customers"
import type { CustomerListQuery } from "@/lib/customers/customer-list"
import type { CustomerOperationalSummary } from "@/lib/customers/customer-operational"
import type {
  CreateCustomerPayload,
  CustomersRepositoryResult,
  UpdateCustomerPayload,
} from "@/lib/types/supabase/customers"

export function createBrowserCustomersClient(): SupabaseCustomersClient {
  return createClient()
}

export async function listCustomerPage(
  companyId: string,
  query: CustomerListQuery,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<CustomerListPage>> {
  return listCustomersPaginated(client, companyId, query)
}

export async function getCustomerSummary(
  companyId: string,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<CustomerOperationalSummary>> {
  return getCustomerOperationalSummaryCounts(client, companyId)
}

export async function getCustomerById(
  id: string,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<Customer>> {
  return fetchCustomerById(client, id)
}

export async function getCustomerDuplicateIndex(
  companyId: string,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<
  CustomersRepositoryResult<
    Pick<Customer, "id" | "name" | "externalCustomerCode" | "dni">[]
  >
> {
  return fetchCustomerDuplicateIndex(client, companyId)
}

export async function checkCustomerCanDelete(
  customerId: string,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const activity = await getCustomerOperationalActivity(client, customerId)
  return canDeleteCustomerWithActivity(activity)
}

export async function searchCustomers(
  companyId: string,
  query: string,
  limit = 8,
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<Customer[]>> {
  return querySearchCustomers(client, companyId, query, limit)
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

export async function markCustomersAsActive(
  input: {
    customerIds: string[]
    validatedBy: string
  },
  client: SupabaseCustomersClient = createBrowserCustomersClient()
): Promise<CustomersRepositoryResult<Customer[]>> {
  return markCustomersValidated(client, input)
}

export type { CustomerListRow }
