import type { SupabaseClient } from "@supabase/supabase-js"

import { generateCustomerNumber } from "@/lib/customers/customer-number"
import {
  canExcludeCustomerFromOperations,
  getCustomerOperationalActivity,
} from "@/lib/customers/customer-activity"
import { CUSTOMER_DELETE_BLOCKED_MESSAGE } from "@/lib/customers/customer-delete"
import type { Database } from "@/lib/supabase/database.types"
import {
  mapCustomerInsert,
  mapCustomerRowToCustomer,
  mapCustomerUpdate,
} from "@/lib/supabase/customers.mapper"
import type { Customer } from "@/lib/types/customers"
import type {
  CreateCustomerPayload,
  CustomersRepositoryResult,
  UpdateCustomerPayload,
} from "@/lib/types/supabase/customers"

export type SupabaseCustomersClient = SupabaseClient<Database>

function mapSupabaseCustomerError(error: {
  code?: string
  message: string
}) {
  if (error.code === "23505") {
    return {
      code: "DUPLICATE_NUMBER" as const,
      message: "Ya existe un cliente con ese número.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

async function fetchLatestCustomerNumber(
  client: SupabaseCustomersClient
): Promise<string | null> {
  const { data, error } = await client
    .from("customers")
    .select("customer_number")
    .order("customer_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.customer_number
}

export async function getCustomers(
  client: SupabaseCustomersClient
): Promise<CustomersRepositoryResult<Customer[]>> {
  const { data, error } = await client
    .from("customers")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  return {
    data: (data ?? []).map(mapCustomerRowToCustomer),
    error: null,
  }
}

export async function searchCustomers(
  client: SupabaseCustomersClient,
  query: string,
  limit = 8
): Promise<CustomersRepositoryResult<Customer[]>> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    const allCustomers = await getCustomers(client)
    if (allCustomers.error || allCustomers.data === null) {
      return allCustomers
    }

    return {
      data: allCustomers.data.slice(0, limit),
      error: null,
    }
  }

  const pattern = `%${normalizedQuery.replace(/[%_,]/g, "")}%`
  const { data, error } = await client
    .from("customers")
    .select("*")
    .or(
      [
        `external_customer_code.ilike.${pattern}`,
        `dni.ilike.${pattern}`,
        `name.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `address.ilike.${pattern}`,
        `locality.ilike.${pattern}`,
      ].join(",")
    )
    .order("name", { ascending: true })
    .limit(limit)

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  return {
    data: (data ?? []).map(mapCustomerRowToCustomer),
    error: null,
  }
}

export async function createCustomer(
  client: SupabaseCustomersClient,
  payload: Omit<CreateCustomerPayload, "customerNumber"> & {
    customerNumber?: string
  }
): Promise<CustomersRepositoryResult<Customer>> {
  const latestNumber = await fetchLatestCustomerNumber(client)
  const customerNumber =
    payload.customerNumber?.trim() ||
    generateCustomerNumber(
      latestNumber ? [{ customerNumber: latestNumber }] : []
    )

  const { data, error } = await client
    .from("customers")
    .insert(
      mapCustomerInsert({
        ...payload,
        customerNumber,
      })
    )
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  return {
    data: mapCustomerRowToCustomer(data),
    error: null,
  }
}

export async function updateCustomer(
  client: SupabaseCustomersClient,
  id: string,
  payload: UpdateCustomerPayload
): Promise<CustomersRepositoryResult<Customer>> {
  const update = mapCustomerUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const isSoftDelete =
    payload.deletedAt !== undefined && payload.deletedAt !== null

  if (isSoftDelete) {
    const { error } = await client
      .from("customers")
      .update(update)
      .eq("id", id)
      .is("deleted_at", null)

    if (error) {
      return { data: null, error: mapSupabaseCustomerError(error) }
    }

    return { data: null, error: null, ok: true }
  }

  const { data, error } = await client
    .from("customers")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Cliente no encontrado.",
      },
    }
  }

  return {
    data: mapCustomerRowToCustomer(data),
    error: null,
  }
}

export async function deleteCustomer(
  client: SupabaseCustomersClient,
  id: string
): Promise<CustomersRepositoryResult<void>> {
  const activity = await getCustomerOperationalActivity(client, id)
  const excludeCheck = canExcludeCustomerFromOperations(activity)

  if (!excludeCheck.allowed) {
    return {
      data: null,
      error: {
        code: "HAS_OPERATIONAL_ACTIVITY",
        message: excludeCheck.message || CUSTOMER_DELETE_BLOCKED_MESSAGE,
      },
    }
  }

  const { error } = await client
    .from("customers")
    .delete()
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  return { data: null, error: null, ok: true }
}

export async function markCustomersValidated(
  client: SupabaseCustomersClient,
  input: {
    customerIds: string[]
    validatedBy: string
    validatedAt?: string
  }
): Promise<CustomersRepositoryResult<Customer[]>> {
  if (input.customerIds.length === 0) {
    return { data: [], error: null }
  }

  const validatedAt = input.validatedAt ?? new Date().toISOString()
  const updated: Customer[] = []

  for (const id of input.customerIds) {
    const result = await updateCustomer(client, id, {
      validationStatus: "active",
      validatedBy: input.validatedBy,
      validatedAt,
    })

    if (result.error || !result.data) {
      return {
        data: null,
        error: result.error ?? {
          code: "UNKNOWN",
          message: "No se pudo marcar el cliente como activo.",
        },
      }
    }

    updated.push(result.data)
  }

  return { data: updated, error: null }
}
