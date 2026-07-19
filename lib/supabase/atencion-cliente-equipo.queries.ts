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
import { countBajasProcedidasInPeriod } from "@/lib/supabase/customer-retenciones.queries"
import { mapCustomerAtencionRowToCustomerAtencion } from "@/lib/supabase/customer-atenciones.mapper"
import { countSeguimientosResueltosForEmployeeInRange } from "@/lib/supabase/customer-seguimientos.queries"
import {
  getCustomerRecuperacionDisplayName,
  getCustomerRecuperacionZoneLabel,
} from "@/lib/customer-recuperaciones/format"
import { mapCustomerRecuperacionRowToCustomerRecuperacion } from "@/lib/supabase/customer-recuperaciones.mapper"
import type { Database } from "@/lib/supabase/database.types"
import type { CustomerRecuperacionJornadaRow } from "@/lib/types/customer-recuperaciones"
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
    recuperacionesResult,
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
      .order("updated_at", { ascending: false })
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
        "id, customer_id, resultado, resolution, completed_at, completed_by_employee_id, administration_pending_at, assigned_employee_id, status"
      )
      .eq("company_id", companyId)
      .or(
        `and(status.eq.finalizada,completed_by_employee_id.eq.${employeeId},completed_at.gte.${bounds.start},completed_at.lt.${bounds.end}),and(assigned_employee_id.eq.${employeeId},resultado.eq.persiste_baja,administration_pending_at.gte.${bounds.start},administration_pending_at.lt.${bounds.end})`
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    client
      .from("customer_recuperaciones")
      .select(
        "id, customer_id, manual_customer_name, manual_zone, channel, offer, observation, resultado, created_at"
      )
      .eq("company_id", companyId)
      .eq("performed_by_employee_id", employeeId)
      .gte("created_at", bounds.start)
      .lt("created_at", bounds.end)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
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

  if (recuperacionesResult.error) {
    return { data: null, error: mapQueryError(recuperacionesResult.error) }
  }

  const atencionRows = atencionesResult.data ?? []
  const seguimientoRows = (seguimientosCompletadosResult.data ?? []).filter(
    (row) => row.completed_at && row.completion_action
  )
  const retencionRows = (retencionesResult.data ?? []).filter((row) => {
    if (row.resultado === "persiste_baja") {
      return Boolean(row.administration_pending_at && row.resolution?.trim())
    }

    return Boolean(
      row.status === "finalizada" &&
        row.completed_at &&
        row.resultado &&
        row.resolution?.trim()
    )
  })
  const recuperacionRows = recuperacionesResult.data ?? []

  const customerNameById = await loadCustomerNamesById(
    client,
    companyId,
    [
      ...new Set([
        ...atencionRows.map((row) => row.customer_id),
        ...seguimientoRows.map((row) => row.customer_id),
        ...retencionRows.map((row) => row.customer_id),
        ...recuperacionRows
          .map((row) => row.customer_id)
          .filter((id): id is string => Boolean(id)),
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

  const retenciones: CustomerRetencionJornadaRow[] = retencionRows
    .map((row) => ({
      id: row.id,
      kind: "retencion" as const,
      occurredAt:
        row.resultado === "persiste_baja"
          ? row.administration_pending_at!
          : row.completed_at!,
      customerId: row.customer_id,
      customerName: customerNameById.get(row.customer_id) ?? "Cliente",
      resultado: row.resultado as CustomerRetencionJornadaRow["resultado"],
      resolution: row.resolution!,
    }))
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
    )

  const clientesRetenidos = retenciones.filter(
    (row) => row.resultado === "retenido"
  ).length
  const bajasProcedidas = countBajasProcedidasInPeriod(retencionRows, bounds)

  const recuperaciones: CustomerRecuperacionJornadaRow[] = recuperacionRows.map(
    (row) => {
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
      const customerName = row.customer_id
        ? customerNameById.get(row.customer_id)
        : undefined

      return {
        id: row.id,
        kind: "recupero" as const,
        occurredAt: row.created_at,
        displayName: getCustomerRecuperacionDisplayName(mapped, customerName),
        zoneLabel: getCustomerRecuperacionZoneLabel(mapped, customerName),
        channel: mapped.channel,
        offer: row.offer,
        resultado: mapped.resultado,
        observation: row.observation,
      }
    }
  )

  const clientesRecuperados = recuperaciones.filter(
    (row) => row.resultado === "recuperado"
  ).length

  const activity = buildJornadaEntries({
    atenciones: atencionRows.map((row) => ({
      atencion: mapCustomerAtencionRowToCustomerAtencion(row),
      customerName: customerNameById.get(row.customer_id) ?? "Cliente",
    })),
    seguimientos,
    retenciones,
    recuperaciones,
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
        bajasProcedidas,
        recuperosGestionados: recuperaciones.length,
        clientesRecuperados,
      }),
      activity,
    },
    error: null,
  }
}
