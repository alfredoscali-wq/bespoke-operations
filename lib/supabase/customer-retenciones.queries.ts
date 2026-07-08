import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateCustomerRetencionPayloadToInsert,
  mapCustomerRetencionRowToCustomerRetencion,
  mapUpdateCustomerRetencionCompletePayloadToUpdate,
} from "@/lib/supabase/customer-retenciones.mapper"
import type {
  AtencionClienteAssigneeOption,
  CustomerRetencion,
  CustomerRetencionActiveRow,
  CustomerRetencionJornadaRow,
  CustomerRetencionSupervisionRow,
} from "@/lib/types/customer-retenciones"
import type {
  CreateCustomerRetencionPayload,
  CustomerRetencionesRepositoryResult,
  UpdateCustomerRetencionCompletePayload,
} from "@/lib/types/supabase/customer-retenciones"

export type SupabaseCustomerRetencionesClient = SupabaseClient<Database>

const RETENCION_SELECT =
  "id, company_id, customer_id, assigned_employee_id, assigned_by_employee_id, motivo_baja, detail, status, resultado, resolution, completed_at, completed_by_employee_id, created_at, updated_at, deleted_at"

const RETENCION_ACTIVE_SELECT =
  "id, customer_id, assigned_by_employee_id, motivo_baja, detail, created_at"

const RETENCION_SUPERVISION_SELECT =
  "id, customer_id, assigned_employee_id, assigned_by_employee_id, motivo_baja, detail, status, resultado, resolution, completed_at, created_at"

export function mapSupabaseCustomerRetencionError(error: {
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

async function loadCustomerNamesById(
  client: SupabaseCustomerRetencionesClient,
  companyId: string,
  customerIds: string[]
): Promise<Map<string, string>> {
  if (customerIds.length === 0) {
    return new Map()
  }

  const { data } = await client
    .from("customers")
    .select("id, name")
    .eq("company_id", companyId)
    .in("id", customerIds)
    .is("deleted_at", null)

  return new Map((data ?? []).map((row) => [row.id, row.name]))
}

async function loadEmployeeNamesById(
  client: SupabaseCustomerRetencionesClient,
  companyId: string,
  employeeIds: string[]
): Promise<Map<string, string>> {
  if (employeeIds.length === 0) {
    return new Map()
  }

  const { data } = await client
    .from("employees")
    .select("id, first_name, last_name, preferred_name")
    .eq("company_id", companyId)
    .in("id", employeeIds)
    .is("deleted_at", null)

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      row.preferred_name?.trim() ||
        `${row.first_name} ${row.last_name}`.trim(),
    ])
  )
}

export async function fetchAtencionClienteAssignees(
  client: SupabaseCustomerRetencionesClient,
  companyId: string
): Promise<CustomerRetencionesRepositoryResult<AtencionClienteAssigneeOption[]>> {
  const { data: roles, error: rolesError } = await client
    .from("company_roles")
    .select("id")
    .eq("company_id", companyId)
    .eq("code", "atencion_cliente")

  if (rolesError) {
    return { data: null, error: mapSupabaseCustomerRetencionError(rolesError) }
  }

  const roleIds = (roles ?? []).map((role) => role.id)

  if (roleIds.length === 0) {
    return { data: [], error: null }
  }

  const { data, error } = await client
    .from("employees")
    .select("id, first_name, last_name, preferred_name")
    .eq("company_id", companyId)
    .eq("employment_status", "active")
    .in("role_id", roleIds)
    .is("deleted_at", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      displayName:
        row.preferred_name?.trim() ||
        `${row.first_name} ${row.last_name}`.trim(),
    })),
    error: null,
  }
}

export async function fetchPendingRetencionesForEmployee(
  client: SupabaseCustomerRetencionesClient,
  companyId: string,
  employeeId: string
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionActiveRow[]>> {
  const { data, error } = await client
    .from("customer_retenciones")
    .select(RETENCION_ACTIVE_SELECT)
    .eq("company_id", companyId)
    .eq("assigned_employee_id", employeeId)
    .eq("status", "pendiente")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  const rows = data ?? []
  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    rows.map((row) => row.customer_id)
  )
  const employeeNameById = await loadEmployeeNamesById(
    client,
    companyId,
    rows.map((row) => row.assigned_by_employee_id)
  )

  return {
    data: rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: customerNameById.get(row.customer_id) ?? "Cliente",
      motivoBaja: row.motivo_baja as CustomerRetencionActiveRow["motivoBaja"],
      detail: row.detail,
      createdAt: row.created_at,
      assignedByEmployeeId: row.assigned_by_employee_id,
      assignedByEmployeeName:
        employeeNameById.get(row.assigned_by_employee_id) ?? "Administración",
    })),
    error: null,
  }
}

export async function fetchAssignedRetencionesForCompany(
  client: SupabaseCustomerRetencionesClient,
  companyId: string
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionSupervisionRow[]>> {
  const { data, error } = await client
    .from("customer_retenciones")
    .select(RETENCION_SUPERVISION_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  const rows = data ?? []
  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    rows.map((row) => row.customer_id)
  )
  const employeeNameById = await loadEmployeeNamesById(
    client,
    companyId,
    [
      ...rows.map((row) => row.assigned_employee_id),
      ...rows.map((row) => row.assigned_by_employee_id),
    ]
  )

  return {
    data: rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: customerNameById.get(row.customer_id) ?? "Cliente",
      assignedEmployeeId: row.assigned_employee_id,
      assignedEmployeeName:
        employeeNameById.get(row.assigned_employee_id) ?? "Responsable",
      assignedByEmployeeId: row.assigned_by_employee_id,
      assignedByEmployeeName:
        employeeNameById.get(row.assigned_by_employee_id) ?? "Administración",
      motivoBaja: row.motivo_baja as CustomerRetencionSupervisionRow["motivoBaja"],
      detail: row.detail,
      status: row.status as CustomerRetencionSupervisionRow["status"],
      resultado: row.resultado as CustomerRetencionSupervisionRow["resultado"],
      resolution: row.resolution,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    })),
    error: null,
  }
}

export async function fetchCustomerRetencionById(
  client: SupabaseCustomerRetencionesClient,
  id: string,
  companyId?: string
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  let query = client.from("customer_retenciones").select(RETENCION_SELECT).eq("id", id)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Retención no encontrada." },
    }
  }

  return {
    data: mapCustomerRetencionRowToCustomerRetencion(data),
    error: null,
  }
}

export async function insertCustomerRetencion(
  client: SupabaseCustomerRetencionesClient,
  payload: CreateCustomerRetencionPayload
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  const { data, error } = await client
    .from("customer_retenciones")
    .insert(mapCreateCustomerRetencionPayloadToInsert(payload))
    .select(RETENCION_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  return {
    data: mapCustomerRetencionRowToCustomerRetencion(data),
    error: null,
  }
}

export async function completeCustomerRetencion(
  client: SupabaseCustomerRetencionesClient,
  id: string,
  payload: UpdateCustomerRetencionCompletePayload,
  companyId?: string
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencion>> {
  let query = client
    .from("customer_retenciones")
    .update(mapUpdateCustomerRetencionCompletePayloadToUpdate(payload))
    .eq("id", id)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.select(RETENCION_SELECT).single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  return {
    data: mapCustomerRetencionRowToCustomerRetencion(data),
    error: null,
  }
}

export async function countActiveRetencionesForEmployee(
  client: SupabaseCustomerRetencionesClient,
  companyId: string,
  employeeId: string
): Promise<CustomerRetencionesRepositoryResult<number>> {
  const { count, error } = await client
    .from("customer_retenciones")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("assigned_employee_id", employeeId)
    .eq("status", "pendiente")
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  return { data: count ?? 0, error: null }
}

export async function fetchCompletedRetencionesToday(
  client: SupabaseCustomerRetencionesClient,
  companyId: string,
  employeeId: string,
  referenceDate: Date
): Promise<CustomerRetencionesRepositoryResult<CustomerRetencionJornadaRow[]>> {
  const { start, end } = getDayBoundsIso(referenceDate)

  const { data, error } = await client
    .from("customer_retenciones")
    .select(
      "id, customer_id, resultado, resolution, completed_at, completed_by_employee_id"
    )
    .eq("company_id", companyId)
    .eq("completed_by_employee_id", employeeId)
    .eq("status", "finalizada")
    .gte("completed_at", start)
    .lt("completed_at", end)
    .is("deleted_at", null)
    .order("completed_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseCustomerRetencionError(error) }
  }

  const rows = (data ?? []).filter(
    (row) => row.completed_at && row.resultado && row.resolution
  )
  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    rows.map((row) => row.customer_id)
  )

  return {
    data: rows.map((row) => ({
      id: row.id,
      kind: "retencion" as const,
      completedAt: row.completed_at!,
      customerId: row.customer_id,
      customerName: customerNameById.get(row.customer_id) ?? "Cliente",
      resultado: row.resultado as CustomerRetencionJornadaRow["resultado"],
      resolution: row.resolution!,
    })),
    error: null,
  }
}
