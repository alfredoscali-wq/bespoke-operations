import type { JornadaEntry } from "@/lib/customer-seguimientos/jornada"
import type { EquipoReportPeriod } from "@/lib/atencion-cliente-equipo/period"

export type EquipoIndividualReportKpis = {
  atenciones: number
  resueltas: number
  seguimientosCompletados: number
  seguimientosPendientes: number
  retencionesGestionadas: number
  clientesRetenidos: number
  bajasProcedidas: number
  recuperosGestionados: number
  clientesRecuperados: number
}

export type EquipoIndividualReport = {
  employeeId: string
  employeeName: string
  period: EquipoReportPeriod
  periodLabel: string
  kpis: EquipoIndividualReportKpis
  activity: JornadaEntry[]
}

export function computeResueltasKpi(
  atencionesResueltas: number,
  seguimientosResueltos: number
): number {
  return atencionesResueltas + seguimientosResueltos
}

export function buildEquipoIndividualReportKpis(input: {
  atenciones: number
  atencionesResueltas: number
  seguimientosResueltos: number
  seguimientosCompletados: number
  seguimientosPendientes: number
  retencionesGestionadas: number
  clientesRetenidos: number
  bajasProcedidas: number
  recuperosGestionados: number
  clientesRecuperados: number
}): EquipoIndividualReportKpis {
  return {
    atenciones: input.atenciones,
    resueltas: computeResueltasKpi(
      input.atencionesResueltas,
      input.seguimientosResueltos
    ),
    seguimientosCompletados: input.seguimientosCompletados,
    seguimientosPendientes: input.seguimientosPendientes,
    retencionesGestionadas: input.retencionesGestionadas,
    clientesRetenidos: input.clientesRetenidos,
    bajasProcedidas: input.bajasProcedidas,
    recuperosGestionados: input.recuperosGestionados,
    clientesRecuperados: input.clientesRecuperados,
  }
}
