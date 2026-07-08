import { canViewEquipoIndividualReport } from "@/lib/atencion-cliente-equipo/access"
import type { EquipoIndividualReport } from "@/lib/atencion-cliente-equipo/report"
import type { EquipoReportPeriod } from "@/lib/atencion-cliente-equipo/period"
import { createClient } from "@/lib/supabase/client"
import {
  fetchEquipoIndividualReport,
  type AtencionClienteEquipoRepositoryResult,
  type SupabaseAtencionClienteEquipoClient,
} from "@/lib/supabase/atencion-cliente-equipo.queries"

export async function loadEquipoIndividualReport(
  input: {
    companyId: string
    employeeId: string
    period: EquipoReportPeriod
    roleCode: string | null | undefined
    referenceDate?: Date
  },
  client: SupabaseAtencionClienteEquipoClient = createClient()
): Promise<AtencionClienteEquipoRepositoryResult<EquipoIndividualReport>> {
  if (!canViewEquipoIndividualReport(input.roleCode)) {
    return {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "Solo Administrador puede consultar reportes individuales.",
      },
    }
  }

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
    client,
    input.companyId,
    input.employeeId,
    input.period,
    input.referenceDate
  )
}
