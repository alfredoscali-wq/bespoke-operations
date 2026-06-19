import type { SupabaseClient } from "@supabase/supabase-js"

import { generateCustomerNumber } from "@/lib/customers/customer-number"
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
        `customer_number.ilike.${pattern}`,
        `name.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `address.ilike.${pattern}`,
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
