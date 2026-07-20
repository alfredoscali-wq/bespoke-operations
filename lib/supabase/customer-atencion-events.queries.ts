import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateCustomerAtencionEventPayloadToInsert,
  mapCustomerAtencionEventRowToCustomerAtencionEvent,
} from "@/lib/supabase/customer-atencion-events.mapper"
import type { CustomerAtencionEvent } from "@/lib/types/customer-atencion-events"
import type {
  CreateCustomerAtencionEventPayload,
  CustomerAtencionEventsRepositoryResult,
} from "@/lib/types/supabase/customer-atencion-events"

export type SupabaseCustomerAtencionEventsClient = SupabaseClient<Database>

const EVENT_SELECT =
  "id, company_id, customer_atencion_id, employee_id, action_type, detail, previous_status, new_status, previous_next_step, new_next_step, interaction_kind, interaction_result, next_action_at, created_at"

export function mapSupabaseCustomerAtencionEventError(error: {
  code?: string
  message: string
}) {
  if (error.code === "23514") {
    return {
      code: "VALIDATION" as const,
      message: error.message,
    }
  }

  if (error.code === "42501") {
    return {
      code: "FORBIDDEN" as const,
      message: "Permisos insuficientes para realizar esta operación.",
    }
  }

  if (error.code === "22P02") {
    return {
      code: "VALIDATION" as const,
      message: "Identificador inválido.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function insertCustomerAtencionEvent(
  client: SupabaseCustomerAtencionEventsClient,
  payload: CreateCustomerAtencionEventPayload
): Promise<CustomerAtencionEventsRepositoryResult<CustomerAtencionEvent>> {
  const { data, error } = await client
    .from("customer_atencion_events")
    .insert(mapCreateCustomerAtencionEventPayloadToInsert(payload))
    .select(EVENT_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerAtencionEventError(error) }
  }

  return {
    data: mapCustomerAtencionEventRowToCustomerAtencionEvent(data),
    error: null,
  }
}

export async function fetchCustomerAtencionEventsByAtencionId(
  client: SupabaseCustomerAtencionEventsClient,
  companyId: string,
  customerAtencionId: string
): Promise<CustomerAtencionEventsRepositoryResult<CustomerAtencionEvent[]>> {
  const { data, error } = await client
    .from("customer_atencion_events")
    .select(EVENT_SELECT)
    .eq("company_id", companyId)
    .eq("customer_atencion_id", customerAtencionId)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseCustomerAtencionEventError(error) }
  }

  return {
    data: (data ?? []).map(mapCustomerAtencionEventRowToCustomerAtencionEvent),
    error: null,
  }
}
