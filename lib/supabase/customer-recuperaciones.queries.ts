import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getCustomerRecuperacionDisplayName,
  getCustomerRecuperacionZoneLabel,
} from "@/lib/customer-recuperaciones/format"
import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateCustomerRecuperacionPayloadToInsert,
  mapCustomerRecuperacionRowToCustomerRecuperacion,
} from "@/lib/supabase/customer-recuperaciones.mapper"
import type {
  CustomerRecuperacion,
  CustomerRecuperacionActivityRow,
  CustomerRecuperacionJornadaRow,
} from "@/lib/types/customer-recuperaciones"
import type {
  CreateCustomerRecuperacionPayload,
  CustomerRecuperacionesRepositoryResult,
} from "@/lib/types/supabase/customer-recuperaciones"

export type SupabaseCustomerRecuperacionesClient = SupabaseClient<Database>

const RECUPERACION_SELECT =
  "id, company_id, customer_id, manual_customer_name, manual_zone, manual_phone, performed_by_employee_id, channel, offer, observation, resultado, created_at, updated_at, deleted_at"

export function mapSupabaseCustomerRecuperacionError(error: {
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

function getDayBoundsIso(referenceDate: Date): { start: string; end: string } {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  )
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

async function loadCustomerMetaById(
  client: SupabaseCustomerRecuperacionesClient,
  companyId: string,
  customerIds: string[]
): Promise<Map<string, { name: string; locality: string | null }>> {
  if (customerIds.length === 0) {
    return new Map()
  }

  const { data } = await client
    .from("customers")
    .select("id, name, locality")
    .eq("company_id", companyId)
    .in("id", customerIds)
    .is("deleted_at", null)

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      { name: row.name, locality: row.locality },
    ])
  )
}

function mapPartialRowToActivityRow(
  row: {
    id: string
    customer_id: string | null
    manual_customer_name: string | null
    manual_zone: string | null
    manual_phone: string | null
    channel: string
    offer: string
    observation: string
    resultado: string
    created_at: string
  },
  customerMeta?: { name: string; locality: string | null }
): CustomerRecuperacionActivityRow {
  const mapped = mapCustomerRecuperacionRowToCustomerRecuperacion({
    id: row.id,
    company_id: "",
    customer_id: row.customer_id,
    manual_customer_name: row.manual_customer_name,
    manual_zone: row.manual_zone,
    manual_phone: row.manual_phone,
    performed_by_employee_id: "",
    channel: row.channel,
    offer: row.offer,
    observation: row.observation,
    resultado: row.resultado,
    created_at: row.created_at,
    updated_at: row.created_at,
    deleted_at: null,
  })

  return {
    id: row.id,
    customerId: row.customer_id,
    manualCustomerName: row.manual_customer_name,
    manualZone: row.manual_zone,
    manualPhone: row.manual_phone,
    channel: mapped.channel,
    offer: row.offer,
    observation: row.observation,
    resultado: mapped.resultado,
    createdAt: row.created_at,
    displayName: getCustomerRecuperacionDisplayName(mapped, customerMeta?.name),
    zoneLabel: getCustomerRecuperacionZoneLabel(mapped, customerMeta?.locality),
  }
}

export async function fetchRecuperacionesForEmployee(
  client: SupabaseCustomerRecuperacionesClient,
  companyId: string,
  employeeId: string,
  limit = 50
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacionActivityRow[]>> {
  const { data, error } = await client
    .from("customer_recuperaciones")
    .select(
      "id, customer_id, manual_customer_name, manual_zone, manual_phone, channel, offer, observation, resultado, created_at"
    )
    .eq("company_id", companyId)
    .eq("performed_by_employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { data: null, error: mapSupabaseCustomerRecuperacionError(error) }
  }

  const rows = data ?? []
  const customerMetaById = await loadCustomerMetaById(
    client,
    companyId,
    rows
      .map((row) => row.customer_id)
      .filter((id): id is string => Boolean(id))
  )

  return {
    data: rows.map((row) =>
      mapPartialRowToActivityRow(
        row,
        row.customer_id ? customerMetaById.get(row.customer_id) : undefined
      )
    ),
    error: null,
  }
}

export async function fetchRecuperacionesForEmployeeInRange(
  client: SupabaseCustomerRecuperacionesClient,
  companyId: string,
  employeeId: string,
  bounds: { start: string; end: string }
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacionJornadaRow[]>> {
  const { data, error } = await client
    .from("customer_recuperaciones")
    .select(
      "id, customer_id, manual_customer_name, manual_zone, channel, offer, observation, resultado, created_at"
    )
    .eq("company_id", companyId)
    .eq("performed_by_employee_id", employeeId)
    .gte("created_at", bounds.start)
    .lt("created_at", bounds.end)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseCustomerRecuperacionError(error) }
  }

  const rows = data ?? []
  const customerMetaById = await loadCustomerMetaById(
    client,
    companyId,
    rows
      .map((row) => row.customer_id)
      .filter((id): id is string => Boolean(id))
  )

  return {
    data: rows.map((row) => {
      const mapped = mapCustomerRecuperacionRowToCustomerRecuperacion({
        id: row.id,
        company_id: companyId,
        customer_id: row.customer_id,
        manual_customer_name: row.manual_customer_name,
        manual_zone: row.manual_zone,
        manual_phone: null,
        performed_by_employee_id: employeeId,
        channel: row.channel,
        offer: row.offer,
        observation: row.observation,
        resultado: row.resultado,
        created_at: row.created_at,
        updated_at: row.created_at,
        deleted_at: null,
      })
      const customerMeta = row.customer_id
        ? customerMetaById.get(row.customer_id)
        : undefined

      return {
        id: row.id,
        kind: "recupero" as const,
        occurredAt: row.created_at,
        displayName: getCustomerRecuperacionDisplayName(
          mapped,
          customerMeta?.name
        ),
        zoneLabel: getCustomerRecuperacionZoneLabel(
          mapped,
          customerMeta?.locality
        ),
        channel: mapped.channel,
        offer: row.offer,
        resultado: mapped.resultado,
        observation: row.observation,
      }
    }),
    error: null,
  }
}

export async function countRecuperacionesForEmployeeToday(
  client: SupabaseCustomerRecuperacionesClient,
  companyId: string,
  employeeId: string,
  referenceDate: Date
): Promise<CustomerRecuperacionesRepositoryResult<number>> {
  const { start, end } = getDayBoundsIso(referenceDate)

  const { count, error } = await client
    .from("customer_recuperaciones")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("performed_by_employee_id", employeeId)
    .gte("created_at", start)
    .lt("created_at", end)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseCustomerRecuperacionError(error) }
  }

  return { data: count ?? 0, error: null }
}

export async function fetchCustomerRecuperacionById(
  client: SupabaseCustomerRecuperacionesClient,
  id: string,
  companyId?: string
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacion>> {
  let query = client
    .from("customer_recuperaciones")
    .select(RECUPERACION_SELECT)
    .eq("id", id)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCustomerRecuperacionError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Gestión de recupero no encontrada." },
    }
  }

  return {
    data: mapCustomerRecuperacionRowToCustomerRecuperacion(data),
    error: null,
  }
}

export async function insertCustomerRecuperacion(
  client: SupabaseCustomerRecuperacionesClient,
  payload: CreateCustomerRecuperacionPayload
): Promise<CustomerRecuperacionesRepositoryResult<CustomerRecuperacion>> {
  const { data, error } = await client
    .from("customer_recuperaciones")
    .insert(mapCreateCustomerRecuperacionPayloadToInsert(payload))
    .select(RECUPERACION_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerRecuperacionError(error) }
  }

  return {
    data: mapCustomerRecuperacionRowToCustomerRecuperacion(data),
    error: null,
  }
}

export { getDayBoundsIso as getRecuperacionDayBoundsIso }
