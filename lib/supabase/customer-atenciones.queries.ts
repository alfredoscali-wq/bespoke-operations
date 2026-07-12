import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DEFAULT_ATENCION_PAGE_SIZE,
  escapeAtencionSearchPattern,
  type CustomerAtencionListQuery,
} from "@/lib/customer-atenciones/atencion-list"
import {
  computeSharedInboxKpis,
  filterSharedInboxRows,
  getConsultationDayBoundsIso,
  SHARED_INBOX_MAX_ROWS,
  sortSharedInboxRows,
  type SharedInboxKpiSummary,
  type SharedInboxQuery,
} from "@/lib/customer-atenciones/shared-inbox"
import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateCustomerAtencionPayloadToInsert,
  mapCustomerAtencionRowToCustomerAtencion,
} from "@/lib/supabase/customer-atenciones.mapper"
import type {
  CustomerAtencion,
  CustomerAtencionInboxRow,
  CustomerAtencionListPage,
  CustomerAtencionListRow,
} from "@/lib/types/customer-atenciones"
import type {
  CreateCustomerAtencionPayload,
  CustomerAtencionesRepositoryResult,
} from "@/lib/types/supabase/customer-atenciones"

export type SupabaseCustomerAtencionesClient = SupabaseClient<Database>

const ATENCION_LIST_SELECT =
  "id, customer_id, channel, motivo, resultado, created_at, attended_by_employee_id"

const ATENCION_INBOX_SELECT =
  "id, customer_id, channel, motivo, detail, status, next_step, attended_by_employee_id, active_management_employee_id, active_management_started_at, created_at, updated_at"

export function mapSupabaseCustomerAtencionError(error: {
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

async function loadCustomerNamesById(
  client: SupabaseCustomerAtencionesClient,
  companyId: string,
  customerIds: string[]
): Promise<Map<string, string>> {
  if (customerIds.length === 0) {
    return new Map()
  }

  const { data, error } = await client
    .from("customers")
    .select("id, name")
    .eq("company_id", companyId)
    .in("id", customerIds)
    .is("deleted_at", null)

  if (error || !data) {
    return new Map()
  }

  return new Map(data.map((row) => [row.id, row.name]))
}

async function loadEmployeeNamesById(
  client: SupabaseCustomerAtencionesClient,
  companyId: string,
  employeeIds: string[]
): Promise<Map<string, string>> {
  if (employeeIds.length === 0) {
    return new Map()
  }

  const { data, error } = await client
    .from("employees")
    .select("id, first_name, last_name")
    .eq("company_id", companyId)
    .in("id", employeeIds)
    .is("deleted_at", null)

  if (error || !data) {
    return new Map()
  }

  return new Map(
    data.map((row) => [
      row.id,
      `${row.first_name} ${row.last_name}`.trim() || "Empleado",
    ])
  )
}

function mapRowToInboxRow(
  row: {
    id: string
    customer_id: string
    channel: string
    motivo: string
    detail: string
    status: string
    next_step: string | null
    attended_by_employee_id: string
    active_management_employee_id: string | null
    active_management_started_at: string | null
    created_at: string
    updated_at: string
  },
  customerNameById: Map<string, string>,
  employeeNameById: Map<string, string>
): CustomerAtencionInboxRow {
  const mapped = mapCustomerAtencionRowToCustomerAtencion({
    id: row.id,
    company_id: "",
    customer_id: row.customer_id,
    attended_by_employee_id: row.attended_by_employee_id,
    channel: row.channel,
    motivo: row.motivo,
    detail: row.detail,
    resolution: "",
    resultado: "resuelta",
    status: row.status,
    next_step: row.next_step,
    active_management_employee_id: row.active_management_employee_id,
    active_management_started_at: row.active_management_started_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: null,
  })

  return {
    id: mapped.id,
    customerId: mapped.customerId,
    customerName: customerNameById.get(mapped.customerId) ?? "Cliente",
    channel: mapped.channel,
    motivo: mapped.motivo,
    detail: mapped.detail,
    status: mapped.status,
    nextStep: mapped.nextStep,
    attendedByEmployeeId: mapped.attendedByEmployeeId,
    attendedByEmployeeName:
      employeeNameById.get(mapped.attendedByEmployeeId) ?? "Empleado",
    activeManagementEmployeeId: mapped.activeManagementEmployeeId,
    activeManagementEmployeeName: mapped.activeManagementEmployeeId
      ? employeeNameById.get(mapped.activeManagementEmployeeId) ?? "Empleado"
      : null,
    activeManagementStartedAt: mapped.activeManagementStartedAt,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  }
}

async function fetchSharedInboxSourceRows(
  client: SupabaseCustomerAtencionesClient,
  companyId: string
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencionInboxRow[]>> {
  const { data, error } = await client
    .from("customer_atenciones")
    .select(ATENCION_INBOX_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(SHARED_INBOX_MAX_ROWS)

  if (error) {
    return { data: null, error: mapSupabaseCustomerAtencionError(error) }
  }

  const rows = data ?? []
  const customerIds = [...new Set(rows.map((row) => row.customer_id))]
  const employeeIds = [
    ...new Set(
      rows.flatMap((row) =>
        [row.attended_by_employee_id, row.active_management_employee_id].filter(
          (value): value is string => Boolean(value)
        )
      )
    ),
  ]

  const [customerNameById, employeeNameById] = await Promise.all([
    loadCustomerNamesById(client, companyId, customerIds),
    loadEmployeeNamesById(client, companyId, employeeIds),
  ])

  return {
    data: rows.map((row) =>
      mapRowToInboxRow(row, customerNameById, employeeNameById)
    ),
    error: null,
  }
}

export async function fetchSharedInboxKpiSummary(
  client: SupabaseCustomerAtencionesClient,
  companyId: string,
  referenceDate: Date = new Date()
): Promise<CustomerAtencionesRepositoryResult<SharedInboxKpiSummary>> {
  const sourceResult = await fetchSharedInboxSourceRows(client, companyId)

  if (sourceResult.error || !sourceResult.data) {
    return {
      data: null,
      error: sourceResult.error ?? {
        code: "UNKNOWN",
        message: "No se pudieron cargar las consultas.",
      },
    }
  }

  return {
    data: computeSharedInboxKpis(sourceResult.data, referenceDate),
    error: null,
  }
}

export async function fetchSharedInboxConsultations(
  client: SupabaseCustomerAtencionesClient,
  companyId: string,
  query: SharedInboxQuery,
  referenceDate: Date = new Date()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencionInboxRow[]>> {
  const sourceResult = await fetchSharedInboxSourceRows(client, companyId)

  if (sourceResult.error || !sourceResult.data) {
    return {
      data: null,
      error: sourceResult.error ?? {
        code: "UNKNOWN",
        message: "No se pudieron cargar las consultas.",
      },
    }
  }

  const filtered = filterSharedInboxRows(
    sourceResult.data,
    query,
    referenceDate
  )

  return {
    data: sortSharedInboxRows(filtered, query.statusFilter),
    error: null,
  }
}

export async function fetchSharedInboxResolvedTodayCount(
  client: SupabaseCustomerAtencionesClient,
  companyId: string,
  referenceDate: Date = new Date()
): Promise<CustomerAtencionesRepositoryResult<number>> {
  const { start, end } = getConsultationDayBoundsIso(referenceDate)
  const { count, error } = await client
    .from("customer_atenciones")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "resuelta")
    .gte("updated_at", start)
    .lt("updated_at", end)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseCustomerAtencionError(error) }
  }

  return {
    data: count ?? 0,
    error: null,
  }
}

function mapRowToListRow(
  row: {
    id: string
    customer_id: string
    channel: string
    motivo: string
    resultado: string
    created_at: string
    attended_by_employee_id: string
  },
  customerNameById: Map<string, string>
): CustomerAtencionListRow {
  const mapped = mapCustomerAtencionRowToCustomerAtencion({
    id: row.id,
    company_id: "",
    customer_id: row.customer_id,
    attended_by_employee_id: row.attended_by_employee_id,
    channel: row.channel,
    motivo: row.motivo,
    detail: "",
    resolution: "",
    resultado: row.resultado,
    status: "resuelta",
    next_step: null,
    active_management_employee_id: null,
    active_management_started_at: null,
    created_at: row.created_at,
    updated_at: row.created_at,
    deleted_at: null,
  })

  return {
    id: mapped.id,
    customerId: mapped.customerId,
    customerName: customerNameById.get(mapped.customerId) ?? "Cliente",
    channel: mapped.channel,
    motivo: mapped.motivo,
    resultado: mapped.resultado,
    createdAt: mapped.createdAt,
    attendedByEmployeeId: mapped.attendedByEmployeeId,
  }
}

export async function listCustomerAtencionesPaginated(
  client: SupabaseCustomerAtencionesClient,
  companyId: string,
  input: CustomerAtencionListQuery
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencionListPage>> {
  const pageSize = input.pageSize ?? DEFAULT_ATENCION_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * pageSize
  const search = input.search?.trim() ?? ""

  let query = client
    .from("customer_atenciones")
    .select(ATENCION_LIST_SELECT, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (search) {
    const customerSearch = await client
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .or(
        `name.ilike.${escapeAtencionSearchPattern(search)},external_customer_code.ilike.${escapeAtencionSearchPattern(search)},dni.ilike.${escapeAtencionSearchPattern(search)}`
      )
      .limit(100)

    if (customerSearch.error) {
      return {
        data: null,
        error: mapSupabaseCustomerAtencionError(customerSearch.error),
      }
    }

    const customerIds = (customerSearch.data ?? []).map((row) => row.id)

    if (customerIds.length === 0) {
      return {
        data: {
          items: [],
          total: 0,
          page,
          pageSize,
        },
        error: null,
      }
    }

    query = query.in("customer_id", customerIds)
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1)

  if (error) {
    return { data: null, error: mapSupabaseCustomerAtencionError(error) }
  }

  const rows = data ?? []
  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    [...new Set(rows.map((row) => row.customer_id))]
  )

  return {
    data: {
      items: rows.map((row) => mapRowToListRow(row, customerNameById)),
      total: count ?? 0,
      page,
      pageSize,
    },
    error: null,
  }
}

export async function fetchCustomerAtencionById(
  client: SupabaseCustomerAtencionesClient,
  id: string,
  companyId?: string
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencion>> {
  let query = client
    .from("customer_atenciones")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCustomerAtencionError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Atención no encontrada.",
      },
    }
  }

  return {
    data: mapCustomerAtencionRowToCustomerAtencion(data),
    error: null,
  }
}

export async function insertCustomerAtencion(
  client: SupabaseCustomerAtencionesClient,
  payload: CreateCustomerAtencionPayload
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencion>> {
  const { data, error } = await client
    .from("customer_atenciones")
    .insert(mapCreateCustomerAtencionPayloadToInsert(payload))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerAtencionError(error) }
  }

  return {
    data: mapCustomerAtencionRowToCustomerAtencion(data),
    error: null,
  }
}
