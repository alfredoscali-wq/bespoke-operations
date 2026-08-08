import { createClient } from "@/lib/supabase/client"
import {
  createSubscriptionPreAlta,
  fetchSubscriptionCommissions,
  fetchSubscriptionCustomers,
  fetchSubscriptionSales,
  fetchSubscriptionServices,
  markSubscriptionCommissionPaid,
  transitionSubscriptionCustomer,
  type SupabaseSubscriptionsClient,
  type SubscriptionsRepositoryResult,
} from "@/lib/supabase/subscriptions.queries"
import type { SubscriptionCustomerStatus } from "@/lib/subscriptions/statuses"
import type {
  CreateSubscriptionPreAltaInput,
  SubscriptionCommission,
  SubscriptionCustomer,
  SubscriptionSale,
  SubscriptionService,
} from "@/lib/types/subscriptions"

export function createBrowserSubscriptionsClient(): SupabaseSubscriptionsClient {
  return createClient()
}

export async function listSubscriptionServices(
  companyId: string,
  client: SupabaseSubscriptionsClient = createBrowserSubscriptionsClient()
): Promise<SubscriptionsRepositoryResult<SubscriptionService[]>> {
  return fetchSubscriptionServices(client, companyId)
}

export async function listSubscriptionCustomers(
  companyId: string,
  client: SupabaseSubscriptionsClient = createBrowserSubscriptionsClient()
): Promise<SubscriptionsRepositoryResult<SubscriptionCustomer[]>> {
  return fetchSubscriptionCustomers(client, companyId)
}

export async function listSubscriptionSales(
  companyId: string,
  client: SupabaseSubscriptionsClient = createBrowserSubscriptionsClient()
): Promise<SubscriptionsRepositoryResult<SubscriptionSale[]>> {
  return fetchSubscriptionSales(client, companyId)
}

export async function listSubscriptionCommissions(
  companyId: string,
  client: SupabaseSubscriptionsClient = createBrowserSubscriptionsClient()
): Promise<SubscriptionsRepositoryResult<SubscriptionCommission[]>> {
  return fetchSubscriptionCommissions(client, companyId)
}

export async function registerSubscriptionPreAlta(
  input: CreateSubscriptionPreAltaInput,
  client: SupabaseSubscriptionsClient = createBrowserSubscriptionsClient()
): Promise<
  SubscriptionsRepositoryResult<{
    customer: SubscriptionCustomer
    sale: SubscriptionSale
    commission: SubscriptionCommission | null
  }>
> {
  return createSubscriptionPreAlta(client, input)
}

export async function updateSubscriptionCustomerStatus(
  customerId: string,
  nextStatus: SubscriptionCustomerStatus,
  client: SupabaseSubscriptionsClient = createBrowserSubscriptionsClient()
): Promise<SubscriptionsRepositoryResult<SubscriptionCustomer>> {
  return transitionSubscriptionCustomer(client, customerId, nextStatus)
}

export async function paySubscriptionCommission(
  commissionId: string,
  client: SupabaseSubscriptionsClient = createBrowserSubscriptionsClient()
): Promise<SubscriptionsRepositoryResult<SubscriptionCommission>> {
  return markSubscriptionCommissionPaid(client, commissionId)
}
