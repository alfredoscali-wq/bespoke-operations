import { createClient } from "@/lib/supabase/client"
import {
  fetchCustomerAtencionEventsByAtencionId,
  insertCustomerAtencionEvent,
  type SupabaseCustomerAtencionEventsClient,
} from "@/lib/supabase/customer-atencion-events.queries"
import type { CustomerAtencionEvent } from "@/lib/types/customer-atencion-events"
import type {
  CreateCustomerAtencionEventPayload,
  CustomerAtencionEventsRepositoryResult,
} from "@/lib/types/supabase/customer-atencion-events"

export function createBrowserCustomerAtencionEventsClient(): SupabaseCustomerAtencionEventsClient {
  return createClient()
}

export async function createCustomerAtencionEvent(
  payload: CreateCustomerAtencionEventPayload,
  client: SupabaseCustomerAtencionEventsClient = createBrowserCustomerAtencionEventsClient()
): Promise<CustomerAtencionEventsRepositoryResult<CustomerAtencionEvent>> {
  return insertCustomerAtencionEvent(client, payload)
}

export async function listCustomerAtencionEventsByAtencionId(
  companyId: string,
  customerAtencionId: string,
  client: SupabaseCustomerAtencionEventsClient = createBrowserCustomerAtencionEventsClient()
): Promise<CustomerAtencionEventsRepositoryResult<CustomerAtencionEvent[]>> {
  return fetchCustomerAtencionEventsByAtencionId(
    client,
    companyId,
    customerAtencionId
  )
}
