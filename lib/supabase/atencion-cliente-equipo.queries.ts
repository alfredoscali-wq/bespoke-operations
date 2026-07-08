import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildEquipoIndividualReportKpis,
  type EquipoIndividualReport,
} from "@/lib/atencion-cliente-equipo/report"
import {
  formatEquipoReportPeriodLabel,
  resolveEquipoReportPeriodBounds,
  type EquipoReportPeriod,
} from "@/lib/atencion-cliente-equipo/period"
import { buildJornadaEntries } from "@/lib/customer-seguimientos/jornada"
import { mapCustomerAtencionRowToCustomerAtencion } from "@/lib/supabase/customer-atenciones.mapper"
import { countSeguimientosResueltosForEmployeeInRange } from "@/lib/supabase/customer-seguimientos.queries"
import type { Database } from "@/lib/supabase/database.types"
import type { CustomerRetencionJornadaRow } from "@/lib/types/customer-retenciones"
import type { CustomerSeguimientoJornadaRow } from "@/lib/types/customer-seguimientos"

export type SupabaseAtencionClienteEquipoClient = SupabaseClient<Database>

type RepositoryError = {
  code: "FORBIDDEN" | "VALIDATION" | "UNKNOWN"
  message: string
}

export type AtencionClienteEquipoRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: RepositoryError }

function mapQueryError(error: { code?: string; message: string }): RepositoryError {
  if (error.code === "42501") {
    return {
      code: "FORBIDDEN",
      message: "Permisos insuficientes para realizar esta operación.",
    }
  }

  return {
    code: "UNKNOWN",
    message: error.message,
  }
}

async function loadCustomerNamesById(
  client: SupabaseAtencionClienteEquipoClient,
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

async function loadEmployeeDisplayName(
  client: SupabaseAtencionClienteEquipoClient,
  companyId: string,
  employeeId: string
): Promise<string> {
  const { data } = await client
    .from("employees")
    .select("first_name, last_name, preferred_name")
    .eq("company_id", companyId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!data) {
    return "Empleado"
  }

  return (
    data.preferred_name?.trim() ||
    `${data.first_name} ${data.last_name}`.trim() ||
    "Empleado"
  )
}

export async function fetchEquipoIndividualReport(
  client: SupabaseAtencionClienteEquipoClient,
  companyId: string,
  employeeId: string,
  period: EquipoReportPeriod,
  referenceDate = new Date()
): Promise<AtencionClienteEquipoRepositoryResult<EquipoIndividualReport>> {
  const bounds = resolveEquipoReportPeriodBounds(period, referenceDate)
  const periodLabel = formatEquipoReportPeriodLabel(period)

  const [
    atencionesResult,
    atencionesResueltasResult,
    seguimientosResueltosResult,
    seguimientosCompletadosResult,
    seguimientosPendientesResult,
    retencionesResult,
    employeeName,
  ] = await Promise.all([
    client
      .from("customer_atenciones")
      .select("*")
      .eq("company_id", companyId)
      .eq("attended_by_employee_id", employeeId)
      .gte("created_at", bounds.start)
      .lt("created_at", bounds.end)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    client
      .from("customer_atenciones")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("attended_by_employee_id", employeeId)
      .eq("resultado", "resuelta")
      .gte("created_at", bounds.start)
      .lt("created_at", bounds.end)
      .is("deleted_at", null),
    countSeguimientosResueltosForEmployeeInRange(
      client,
      companyId,
      employeeId,
      bounds
    ),
    client
      .from("customer_seguimientos")
      .select(
        "id, customer_id, source_atencion_id, completion_action, completed_at"
      )
      .eq("company_id", companyId)
      .eq("completed_by_employee_id", employeeId)
      .eq("status", "completado")
      .gte("completed_at", bounds.start)
      .lt("completed_at", bounds.end)
      .is("deleted_at", null)
      .order("completed_at", { ascending: false }),
    client
      .from("customer_seguimientos")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("assigned_employee_id", employeeId)
      .eq("status", "pendiente")
      .is("deleted_at", null),
    client
      .from("customer_retenciones")
      .select(
        "id, customer_id, resultado, resolution, completed_at, completed_by_employee_id"
      )
      .eq("company_id", companyId)
      .eq("completed_by_employee_id", employeeId)
      .eq("status", "finalizada")
      .gte("completed_at", bounds.start)
      .lt("completed_at", bounds.end)
      .is("deleted_at", null)
      .order("completed_at", { ascending: false }),
    loadEmployeeDisplayName(client, companyId, employeeId),
  ])

  if (atencionesResult.error) {
    return { data: null, error: mapQueryError(atencionesResult.error) }
  }

  if (atencionesResueltasResult.error) {
    return { data: null, error: mapQueryError(atencionesResueltasResult.error) }
  }

  if (seguimientosResueltosResult.error) {
    return {
      data: null,
      error: {
        code:
          seguimientosResueltosResult.error.code === "FORBIDDEN"
            ? "FORBIDDEN"
            : "UNKNOWN",
        message: seguimientosResueltosResult.error.message,
      },
    }
  }

  if (seguimientosCompletadosResult.error) {
    return {
      data: null,
      error: mapQueryError(seguimientosCompletadosResult.error),
    }
  }

  if (seguimientosPendientesResult.error) {
    return {
      data: null,
      error: mapQueryError(seguimientosPendientesResult.error),
    }
  }

  if (retencionesResult.error) {
    return { data: null, error: mapQueryError(retencionesResult.error) }
  }

  const atencionRows = atencionesResult.data ?? []
  const seguimientoRows = (seguimientosCompletadosResult.data ?? []).filter(
    (row) => row.completed_at && row.completion_action
  )
  const retencionRows = (retencionesResult.data ?? []).filter(
    (row) => row.completed_at && row.resultado && row.resolution
  )

  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    [
      ...new Set([
        ...atencionRows.map((row) => row.customer_id),
        ...seguimientoRows.map((row) => row.customer_id),
        ...retencionRows.map((row) => row.customer_id),
      ]),
    ]
  )

  const seguimientos: CustomerSeguimientoJornadaRow[] = seguimientoRows.map(
    (row) => ({
      id: row.id,
      kind: "seguimiento" as const,
      completedAt: row.completed_at!,
      customerId: row.customer_id,
      customerName: customerNameById.get(row.customer_id) ?? "Cliente",
      completionAction: row.completion_action!,
      sourceAtencionId: row.source_atencion_id,
    })
  )

  const retenciones: CustomerRetencionJornadaRow[] = retencionRows.map((row) => ({
    id: row.id,
    kind: "retencion" as const,
    completedAt: row.completed_at!,
    customerId: row.customer_id,
    customerName: customerNameById.get(row.customer_id) ?? "Cliente",
    resultado: row.resultado as CustomerRetencionJornadaRow["resultado"],
    resolution: row.resolution!,
  }))

  const clientesRetenidos = retenciones.filter(
    (row) => row.resultado === "retenido"
  ).length
  const noRetenidos = retenciones.filter(
    (row) => row.resultado === "no_retenido"
  ).length

  const activity = buildJornadaEntries({
    atenciones: atencionRows.map((row) => ({
      atencion: mapCustomerAtencionRowToCustomerAtencion(row),
      customerName: customerNameById.get(row.customer_id) ?? "Cliente",
    })),
    seguimientos,
    retenciones,
  })

  return {
    data: {
      employeeId,
      employeeName,
      period,
      periodLabel,
      kpis: buildEquipoIndividualReportKpis({
        atenciones: atencionRows.length,
        atencionesResueltas: atencionesResueltasResult.count ?? 0,
        seguimientosResueltos: seguimientosResueltosResult.data ?? 0,
        seguimientosCompletados: seguimientoRows.length,
        seguimientosPendientes: seguimientosPendientesResult.count ?? 0,
        retencionesGestionadas: retenciones.length,
        clientesRetenidos,
        noRetenidos,
      }),
      activity,
    },
    error: null,
  }
}
