import type { EquipoIndividualReport } from "@/lib/atencion-cliente-equipo/report"
import type { EquipoReportPeriod } from "@/lib/atencion-cliente-equipo/period"
import { createClient } from "@/lib/supabase/client"
import {
  fetchEquipoIndividualReport,
  type AtencionClienteEquipoRepositoryResult,
} from "@/lib/supabase/atencion-cliente-equipo.queries"
import { listEmployeeAvailabilities } from "@/lib/supabase/employee-availability.browser"
import type { EmployeeAvailability } from "@/lib/types/availability"

/**
 * Loads Atención individual metrics for Reportes por Empleado.
 * Uses the same query as Equipo; gated by `/reportes` module access (RLS),
 * not the AC-admin-only Equipo browser gate.
 */
export async function loadEmployeeAtencionMetrics(input: {
  companyId: string
  employeeId: string
  period: EquipoReportPeriod
  referenceDate?: Date
}): Promise<AtencionClienteEquipoRepositoryResult<EquipoIndividualReport>> {
  if (!input.companyId.trim() || !input.employeeId.trim()) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "Seleccioná un empleado para consultar el reporte.",
      },
    }
  }

  return fetchEquipoIndividualReport(
    createClient(),
    input.companyId,
    input.employeeId,
    input.period,
    input.referenceDate
  )
}

export async function loadEmployeeReportAvailabilities(
  companyId: string
): Promise<EmployeeAvailability[]> {
  if (!companyId.trim()) {
    return []
  }

  const result = await listEmployeeAvailabilities(companyId)
  return result.data ?? []
}
