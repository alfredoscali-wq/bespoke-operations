import type { SupabaseClient } from "@supabase/supabase-js"

import {
  formatCustomerNumber,
  generateCustomerNumber,
  parseCustomerNumberCounter,
} from "@/lib/customers/customer-number"
import {
  canExcludeCustomerFromOperations,
  getCustomerOperationalActivity,
} from "@/lib/customers/customer-activity"
import {
  resolveCustomerStatusFilterValue,
  type CustomerListSort,
} from "@/lib/customers/customer-filters"
import {
  DEFAULT_CUSTOMER_PAGE_SIZE,
  escapeCustomerSearchPattern,
  type CustomerListQuery,
} from "@/lib/customers/customer-list"
import type { CustomerOperationalSummary } from "@/lib/customers/customer-operational"
import { CUSTOMER_STATUS_PENDING_ACTIVATION } from "@/lib/customers/format"
import { CUSTOMER_DELETE_BLOCKED_MESSAGE } from "@/lib/customers/customer-delete"
import type { Database, CustomerRow } from "@/lib/supabase/database.types"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  mapCustomerInsert,
  mapCustomerRowToCustomer,
  mapCustomerRowToListRow,
  mapCustomerUpdate,
} from "@/lib/supabase/customers.mapper"
import type { Customer, CustomerListPage } from "@/lib/types/customers"
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
  client: SupabaseCustomersClient,
  companyId: string
): Promise<string | null> {
  const { data, error } = await client
    .from("customers")
    .select("customer_number")
    .eq("company_id", companyId)
    .order("customer_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.customer_number
}

export async function getLatestCustomerNumberCounter(
  client: SupabaseCustomersClient,
  companyId: string
): Promise<number> {
  const latestNumber = await fetchLatestCustomerNumber(client, companyId)
  return parseCustomerNumberCounter(latestNumber)
}

const CUSTOMER_IMPORT_BATCH_SIZE = 100

export async function createCustomersBatch(
  client: SupabaseCustomersClient,
  companyId: string,
  payloads: (Omit<CreateCustomerPayload, "customerNumber"> & {
    customerNumber?: string
  })[],
  startCounter: number
): Promise<
  CustomersRepositoryResult<{
    customers: Customer[]
    nextCounter: number
  }>
> {
  if (payloads.length === 0) {
    return {
      data: { customers: [], nextCounter: startCounter },
      error: null,
    }
  }

  let counter = startCounter
  const rows = payloads.map((payload) => {
    counter += 1
    return mapCustomerInsert({
      ...payload,
      companyId,
      customerNumber:
        payload.customerNumber?.trim() || formatCustomerNumber(counter),
    })
  })

  const { data, error } = await client.from("customers").insert(rows).select("*")

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  return {
    data: {
      customers: (data ?? []).map(mapCustomerRowToCustomer),
      nextCounter: counter,
    },
    error: null,
  }
}

export { CUSTOMER_IMPORT_BATCH_SIZE }

const CUSTOMERS_PAGE_SIZE = 1000

const CUSTOMER_LIST_SELECT =
  "id, name, external_customer_code, dni, address, locality, email, phone, technology, status, validation_status, legacy_migration_id"

const CUSTOMER_DUPLICATE_INDEX_SELECT =
  "id, name, external_customer_code, dni"

function applyCustomerQuickFilter<
  T extends {
    eq: (column: string, value: string) => T
    neq: (column: string, value: string) => T
  },
>(query: T, quickFilter: CustomerListQuery["quickFilter"]): T {
  if (quickFilter === "activos") {
    return query
      .eq("validation_status", "active")
      .neq("status", CUSTOMER_STATUS_PENDING_ACTIVATION)
  }

  if (quickFilter === "pendientes-activacion") {
    return query.eq("status", CUSTOMER_STATUS_PENDING_ACTIVATION)
  }

  if (quickFilter === "revisar") {
    return query.eq("validation_status", "review")
  }

  return query
}

function applyCustomerSearchFilter<
  T extends {
    or: (filters: string) => T
  },
>(query: T, search: string): T {
  const normalizedSearch = search.trim()
  if (!normalizedSearch) {
    return query
  }

  const pattern = escapeCustomerSearchPattern(normalizedSearch)
  const filters = [
    `external_customer_code.ilike.${pattern}`,
    `dni.ilike.${pattern}`,
    `name.ilike.${pattern}`,
    `phone.ilike.${pattern}`,
    `address.ilike.${pattern}`,
    `locality.ilike.${pattern}`,
  ]

  const numericId = Number.parseInt(normalizedSearch, 10)
  if (
    !Number.isNaN(numericId) &&
    String(numericId) === normalizedSearch.replace(/\s/g, "")
  ) {
    filters.push(`legacy_migration_id.eq.${numericId}`)
  }

  return query.or(filters.join(","))
}

function applyCustomerLocalityFilter<
  T extends {
    eq: (column: string, value: string) => T
  },
>(query: T, locality?: string): T {
  const normalizedLocality = locality?.trim()
  if (!normalizedLocality) {
    return query
  }

  return query.eq("locality", normalizedLocality)
}

function applyCustomerStatusFilter<
  T extends {
    eq: (column: string, value: string) => T
  },
>(query: T, statusFilter: CustomerListQuery["statusFilter"]): T {
  const status = resolveCustomerStatusFilterValue(statusFilter ?? "all")
  if (!status) {
    return query
  }

  return query.eq("status", status)
}

function applyCustomerSort<
  T extends {
    order: (
      column: string,
      options: { ascending: boolean }
    ) => T
  },
>(query: T, sort: CustomerListSort = "name-asc"): T {
  switch (sort) {
    case "name-desc":
      return query.order("name", { ascending: false })
    case "created-desc":
      return query.order("created_at", { ascending: false })
    case "created-asc":
      return query.order("created_at", { ascending: true })
    case "name-asc":
    default:
      return query.order("name", { ascending: true })
  }
}

export async function getCustomerLocalityOptions(
  client: SupabaseCustomersClient,
  companyId: string
): Promise<CustomersRepositoryResult<string[]>> {
  const { data, error } = await client
    .from("customers")
    .select("locality")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .not("locality", "is", null)
    .neq("locality", "")
    .order("locality", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  const localities = Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.locality?.trim())
        .filter((locality): locality is string => Boolean(locality))
    )
  ).sort((left, right) => left.localeCompare(right, "es"))

  return { data: localities, error: null }
}

export async function listCustomersPaginated(
  client: SupabaseCustomersClient,
  companyId: string,
  input: CustomerListQuery
): Promise<CustomersRepositoryResult<CustomerListPage>> {
  const pageSize = input.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * pageSize

  let query = client
    .from("customers")
    .select(CUSTOMER_LIST_SELECT, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)

  query = applyCustomerQuickFilter(query, input.quickFilter)
  query = applyCustomerSearchFilter(query, input.search ?? "")
  query = applyCustomerLocalityFilter(query, input.locality)
  query = applyCustomerStatusFilter(query, input.statusFilter)
  query = applyCustomerSort(query, input.sort ?? "name-asc")

  const { data, error, count } = await query.range(offset, offset + pageSize - 1)

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  return {
    data: {
      items: (data ?? []).map(mapCustomerRowToListRow),
      total: count ?? 0,
      page,
      pageSize,
    },
    error: null,
  }
}

export async function getCustomerOperationalSummaryCounts(
  client: SupabaseCustomersClient,
  companyId: string
): Promise<CustomersRepositoryResult<CustomerOperationalSummary>> {
  const base = () =>
    client
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null)

  const [operativosResult, activosResult, pendientesActivacionResult, revisarResult] =
    await Promise.all([
      base(),
      base()
        .eq("validation_status", "active")
        .neq("status", CUSTOMER_STATUS_PENDING_ACTIVATION),
      base().eq("status", CUSTOMER_STATUS_PENDING_ACTIVATION),
      base().eq("validation_status", "review"),
    ])

  const error =
    operativosResult.error ??
    activosResult.error ??
    pendientesActivacionResult.error ??
    revisarResult.error

  if (error) {
    return { data: null, error: mapSupabaseCustomerError(error) }
  }

  return {
    data: {
      operativos: operativosResult.count ?? 0,
      activos: activosResult.count ?? 0,
      "pendientes-activacion": pendientesActivacionResult.count ?? 0,
      revisar: revisarResult.count ?? 0,
    },
    error: null,
  }
}

export async function getCustomerById(
  client: SupabaseCustomersClient,
  id: string
): Promise<CustomersRepositoryResult<Customer>> {
  const { data, error } = await client
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
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

export async function fetchCustomerDuplicateIndex(
  client: SupabaseCustomersClient,
  companyId: string
): Promise<
  CustomersRepositoryResult<
    Pick<Customer, "id" | "name" | "externalCustomerCode" | "dni">[]
  >
> {
  const rows: Pick<Customer, "id" | "name" | "externalCustomerCode" | "dni">[] =
    []
  let offset = 0

  while (true) {
    const { data, error } = await client
      .from("customers")
      .select(CUSTOMER_DUPLICATE_INDEX_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .range(offset, offset + CUSTOMERS_PAGE_SIZE - 1)

    if (error) {
      return { data: null, error: mapSupabaseCustomerError(error) }
    }

    const page = data ?? []
    rows.push(
      ...page.map((row) => ({
        id: row.id,
        name: row.name,
        externalCustomerCode: row.external_customer_code ?? undefined,
        dni: row.dni ?? undefined,
      }))
    )

    if (page.length < CUSTOMERS_PAGE_SIZE) {
      break
    }

    offset += CUSTOMERS_PAGE_SIZE
  }

  return { data: rows, error: null }
}

export async function getCustomers(
  client: SupabaseCustomersClient,
  companyId: string
): Promise<CustomersRepositoryResult<Customer[]>> {
  const rows: CustomerRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await client
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
      .range(offset, offset + CUSTOMERS_PAGE_SIZE - 1)

    if (error) {
      return { data: null, error: mapSupabaseCustomerError(error) }
    }

    const page = data ?? []
    rows.push(...page)

    if (page.length < CUSTOMERS_PAGE_SIZE) {
      break
    }

    offset += CUSTOMERS_PAGE_SIZE
  }

  return {
    data: rows.map(mapCustomerRowToCustomer),
    error: null,
  }
}

export async function searchCustomers(
  client: SupabaseCustomersClient,
  companyId: string,
  query: string,
  limit = 8
): Promise<CustomersRepositoryResult<Customer[]>> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    const { data, error } = await client
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
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

  let searchQuery = client
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  searchQuery = applyCustomerSearchFilter(searchQuery, normalizedQuery)

  const { data, error } = await searchQuery
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
  const companyId = payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID
  const latestNumber = await fetchLatestCustomerNumber(client, companyId)
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
        companyId,
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
