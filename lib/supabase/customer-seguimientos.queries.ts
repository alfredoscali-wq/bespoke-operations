import type { SupabaseClient } from "@supabase/supabase-js"

import {
  enrichAgendaRowOverdue,
  toDateKey,
} from "@/lib/customer-seguimientos/agenda"
import type { AtencionClienteKpiSummary } from "@/lib/customer-seguimientos/kpis"
import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateCustomerSeguimientoPayloadToInsert,
  mapCustomerSeguimientoRowToCustomerSeguimiento,
  mapUpdateCustomerSeguimientoCompletePayloadToUpdate,
} from "@/lib/supabase/customer-seguimientos.mapper"
import type {
  CustomerSeguimiento,
  CustomerSeguimientoAgendaRow,
  CustomerSeguimientoJornadaRow,
} from "@/lib/types/customer-seguimientos"
import type {
  CreateCustomerSeguimientoPayload,
  CustomerSeguimientosRepositoryResult,
  UpdateCustomerSeguimientoCompletePayload,
} from "@/lib/types/supabase/customer-seguimientos"

export type SupabaseCustomerSeguimientosClient = SupabaseClient<Database>

const SEGUIMIENTO_SELECT =
  "id, company_id, customer_id, source_atencion_id, previous_seguimiento_id, assigned_employee_id, scheduled_date, scheduled_time, observation, status, completion_action, completed_at, completed_by_employee_id, created_at, updated_at, deleted_at"

const SEGUIMIENTO_AGENDA_SELECT =
  "id, customer_id, source_atencion_id, scheduled_date, scheduled_time, observation, status"

export function mapSupabaseCustomerSeguimientoError(error: {
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
  client: SupabaseCustomerSeguimientosClient,
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

export async function fetchPendingSeguimientosForEmployee(
  client: SupabaseCustomerSeguimientosClient,
  companyId: string,
  employeeId: string,
  referenceDate: Date
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimientoAgendaRow[]>> {
  const { data, error } = await client
    .from("customer_seguimientos")
    .select(SEGUIMIENTO_AGENDA_SELECT)
    .eq("company_id", companyId)
    .eq("assigned_employee_id", employeeId)
    .eq("status", "pendiente")
    .is("deleted_at", null)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true, nullsFirst: false })

  if (error) {
    return { data: null, error: mapSupabaseCustomerSeguimientoError(error) }
  }

  const rows = data ?? []
  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    [...new Set(rows.map((row) => row.customer_id))]
  )

  return {
    data: rows.map((row) =>
      enrichAgendaRowOverdue(
        {
          id: row.id,
          customerId: row.customer_id,
          customerName: customerNameById.get(row.customer_id) ?? "Cliente",
          sourceAtencionId: row.source_atencion_id,
          scheduledDate: row.scheduled_date,
          scheduledTime: row.scheduled_time,
          observation: row.observation,
          status: "pendiente",
        },
        referenceDate
      )
    ),
    error: null,
  }
}

export async function fetchSeguimientoById(
  client: SupabaseCustomerSeguimientosClient,
  id: string,
  companyId?: string
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimiento>> {
  let query = client
    .from("customer_seguimientos")
    .select(SEGUIMIENTO_SELECT)
    .eq("id", id)
    .is("deleted_at", null)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCustomerSeguimientoError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Seguimiento no encontrado.",
      },
    }
  }

  return {
    data: mapCustomerSeguimientoRowToCustomerSeguimiento(data),
    error: null,
  }
}

export async function insertCustomerSeguimiento(
  client: SupabaseCustomerSeguimientosClient,
  payload: CreateCustomerSeguimientoPayload
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimiento>> {
  const { data, error } = await client
    .from("customer_seguimientos")
    .insert(mapCreateCustomerSeguimientoPayloadToInsert(payload))
    .select(SEGUIMIENTO_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerSeguimientoError(error) }
  }

  return {
    data: mapCustomerSeguimientoRowToCustomerSeguimiento(data),
    error: null,
  }
}

export async function completeCustomerSeguimiento(
  client: SupabaseCustomerSeguimientosClient,
  id: string,
  payload: UpdateCustomerSeguimientoCompletePayload,
  companyId?: string
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimiento>> {
  let query = client
    .from("customer_seguimientos")
    .update(mapUpdateCustomerSeguimientoCompletePayloadToUpdate(payload))
    .eq("id", id)
    .is("deleted_at", null)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.select(SEGUIMIENTO_SELECT).single()

  if (error) {
    return { data: null, error: mapSupabaseCustomerSeguimientoError(error) }
  }

  return {
    data: mapCustomerSeguimientoRowToCustomerSeguimiento(data),
    error: null,
  }
}

export async function fetchCompletedSeguimientosForEmployeeToday(
  client: SupabaseCustomerSeguimientosClient,
  companyId: string,
  employeeId: string,
  referenceDate: Date
): Promise<CustomerSeguimientosRepositoryResult<CustomerSeguimientoJornadaRow[]>> {
  const { start, end } = getDayBoundsIso(referenceDate)

  const { data, error } = await client
    .from("customer_seguimientos")
    .select(
      "id, customer_id, source_atencion_id, completion_action, completed_at"
    )
    .eq("company_id", companyId)
    .eq("completed_by_employee_id", employeeId)
    .eq("status", "completado")
    .gte("completed_at", start)
    .lt("completed_at", end)
    .is("deleted_at", null)
    .order("completed_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseCustomerSeguimientoError(error) }
  }

  const rows = data ?? []
  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    [...new Set(rows.map((row) => row.customer_id))]
  )

  return {
    data: rows
      .filter((row) => row.completed_at && row.completion_action)
      .map((row) => ({
        id: row.id,
        kind: "seguimiento" as const,
        completedAt: row.completed_at!,
        customerId: row.customer_id,
        customerName: customerNameById.get(row.customer_id) ?? "Cliente",
        completionAction: row.completion_action!,
        sourceAtencionId: row.source_atencion_id,
      })),
    error: null,
  }
}

export async function countSeguimientosResueltosForEmployeeInRange(
  client: SupabaseCustomerSeguimientosClient,
  companyId: string,
  employeeId: string,
  bounds: { start: string; end: string }
): Promise<CustomerSeguimientosRepositoryResult<number>> {
  const { data: completedRows, error } = await client
    .from("customer_seguimientos")
    .select("id")
    .eq("company_id", companyId)
    .eq("completed_by_employee_id", employeeId)
    .eq("status", "completado")
    .gte("completed_at", bounds.start)
    .lt("completed_at", bounds.end)
    .is("deleted_at", null)
    .not("completion_action", "is", null)

  if (error) {
    return { data: null, error: mapSupabaseCustomerSeguimientoError(error) }
  }

  const completedIds = (completedRows ?? []).map((row) => row.id)

  if (completedIds.length === 0) {
    return { data: 0, error: null }
  }

  const { data: followUpRows, error: followUpError } = await client
    .from("customer_seguimientos")
    .select("previous_seguimiento_id")
    .eq("company_id", companyId)
    .in("previous_seguimiento_id", completedIds)
    .is("deleted_at", null)

  if (followUpError) {
    return {
      data: null,
      error: mapSupabaseCustomerSeguimientoError(followUpError),
    }
  }

  const spawnedParentIds = new Set(
    (followUpRows ?? [])
      .map((row) => row.previous_seguimiento_id)
      .filter((id): id is string => Boolean(id))
  )

  return {
    data: completedIds.filter((id) => !spawnedParentIds.has(id)).length,
    error: null,
  }
}

export async function countSeguimientosResueltosForEmployeeToday(
  client: SupabaseCustomerSeguimientosClient,
  companyId: string,
  employeeId: string,
  referenceDate: Date
): Promise<CustomerSeguimientosRepositoryResult<number>> {
  const { start, end } = getDayBoundsIso(referenceDate)

  return countSeguimientosResueltosForEmployeeInRange(client, companyId, employeeId, {
    start,
    end,
  })
}

export async function fetchAtencionClienteKpiSummary(
  client: SupabaseCustomerSeguimientosClient,
  companyId: string,
  employeeId: string,
  referenceDate: Date
): Promise<CustomerSeguimientosRepositoryResult<AtencionClienteKpiSummary>> {
  const { start, end } = getDayBoundsIso(referenceDate)

  const [
    atencionesResult,
    resueltasAtencionesResult,
    seguimientosResueltosResult,
    pendientesResult,
  ] = await Promise.all([
    client
      .from("customer_atenciones")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("attended_by_employee_id", employeeId)
      .gte("created_at", start)
      .lt("created_at", end)
      .is("deleted_at", null),
    client
      .from("customer_atenciones")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("attended_by_employee_id", employeeId)
      .eq("resultado", "resuelta")
      .gte("created_at", start)
      .lt("created_at", end)
      .is("deleted_at", null),
    countSeguimientosResueltosForEmployeeInRange(client, companyId, employeeId, {
      start,
      end,
    }),
    client
      .from("customer_seguimientos")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("assigned_employee_id", employeeId)
      .eq("status", "pendiente")
      .is("deleted_at", null),
  ])

  if (atencionesResult.error) {
    return {
      data: null,
      error: mapSupabaseCustomerSeguimientoError(atencionesResult.error),
    }
  }

  if (resueltasAtencionesResult.error) {
    return {
      data: null,
      error: mapSupabaseCustomerSeguimientoError(resueltasAtencionesResult.error),
    }
  }

  if (seguimientosResueltosResult.error) {
    return {
      data: null,
      error: seguimientosResueltosResult.error,
    }
  }

  if (pendientesResult.error) {
    return {
      data: null,
      error: mapSupabaseCustomerSeguimientoError(pendientesResult.error),
    }
  }

  return {
    data: {
      atencionesHoy: atencionesResult.count ?? 0,
      resueltas:
        (resueltasAtencionesResult.count ?? 0) +
        (seguimientosResueltosResult.data ?? 0),
      seguimientosPendientes: pendientesResult.count ?? 0,
      retencionesActivas: 0,
      recuperosHoy: 0,
    },
    error: null,
  }
}

export async function fetchEmployeeAtencionesForDay(
  client: SupabaseCustomerSeguimientosClient,
  companyId: string,
  employeeId: string,
  referenceDate: Date
) {
  const { start, end } = getDayBoundsIso(referenceDate)

  const { data, error } = await client
    .from("customer_atenciones")
    .select("*")
    .eq("company_id", companyId)
    .eq("attended_by_employee_id", employeeId)
    .gte("created_at", start)
    .lt("created_at", end)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseCustomerSeguimientoError(error) }
  }

  return { data: data ?? [], error: null }
}

export { toDateKey }
