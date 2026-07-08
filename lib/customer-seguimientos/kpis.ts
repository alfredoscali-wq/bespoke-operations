import type { VisualTone } from "@/lib/ui/visual-tokens"

export type AtencionClienteKpiKey =
  | "atenciones_hoy"
  | "resueltas"
  | "seguimientos_pendientes"

export type AtencionClienteDashboardFilter =
  | "none"
  | "jornada_atenciones"
  | "jornada_resueltas"
  | "agenda_seguimientos"

export type AtencionClienteKpiSummary = {
  atencionesHoy: number
  resueltas: number
  seguimientosPendientes: number
}

export const ATENCION_CLIENTE_KPI_ORDER: AtencionClienteKpiKey[] = [
  "atenciones_hoy",
  "resueltas",
  "seguimientos_pendientes",
]

export const ATENCION_CLIENTE_KPI_LABELS: Record<AtencionClienteKpiKey, string> =
  {
    atenciones_hoy: "Atenciones hoy",
    resueltas: "Resueltas",
    seguimientos_pendientes: "Seguimientos pendientes",
  }

export const ATENCION_CLIENTE_KPI_TONE: Record<AtencionClienteKpiKey, VisualTone> =
  {
    atenciones_hoy: "blue",
    resueltas: "green",
    seguimientos_pendientes: "amber",
  }

/**
 * Resueltas cuenta solo Atenciones con resultado `resuelta` del día.
 * Los Seguimientos completados aparecen en Mi Jornada pero no en este KPI.
 */
export function getAtencionClienteKpiValue(
  summary: AtencionClienteKpiSummary,
  key: AtencionClienteKpiKey
): number {
  switch (key) {
    case "atenciones_hoy":
      return summary.atencionesHoy
    case "resueltas":
      return summary.resueltas
    case "seguimientos_pendientes":
      return summary.seguimientosPendientes
  }
}

export function mapKpiKeyToDashboardFilter(
  key: AtencionClienteKpiKey,
  current: AtencionClienteDashboardFilter
): AtencionClienteDashboardFilter {
  const next: Record<AtencionClienteKpiKey, AtencionClienteDashboardFilter> = {
    atenciones_hoy: "jornada_atenciones",
    resueltas: "jornada_resueltas",
    seguimientos_pendientes: "agenda_seguimientos",
  }

  return current === next[key] ? "none" : next[key]
}

export function mapDashboardFilterToJornadaFilter(
  filter: AtencionClienteDashboardFilter
): "all" | "atenciones" | "resueltas" {
  if (filter === "jornada_atenciones") {
    return "atenciones"
  }

  if (filter === "jornada_resueltas") {
    return "resueltas"
  }

  return "all"
}
