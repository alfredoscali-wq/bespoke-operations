import type { VisualTone } from "@/lib/ui/visual-tokens"

export type AtencionClienteKpiKey =
  | "atenciones_hoy"
  | "resueltas"
  | "seguimientos_pendientes"
  | "retenciones_activas"
  | "recuperos_hoy"

export type AtencionClienteDashboardFilter =
  | "none"
  | "jornada_atenciones"
  | "jornada_resueltas"
  | "agenda_seguimientos"
  | "retenciones_activas"
  | "mi_recupero"

export type AtencionClienteKpiSummary = {
  atencionesHoy: number
  resueltas: number
  seguimientosPendientes: number
  retencionesActivas: number
  recuperosHoy: number
}

export const ATENCION_CLIENTE_KPI_ORDER: AtencionClienteKpiKey[] = [
  "atenciones_hoy",
  "resueltas",
  "seguimientos_pendientes",
  "retenciones_activas",
  "recuperos_hoy",
]

export const ATENCION_CLIENTE_KPI_LABELS: Record<AtencionClienteKpiKey, string> =
  {
    atenciones_hoy: "Atenciones hoy",
    resueltas: "Resueltas",
    seguimientos_pendientes: "Seguimientos pendientes",
    retenciones_activas: "Retenciones activas",
    recuperos_hoy: "Recuperos hoy",
  }

export const ATENCION_CLIENTE_KPI_TONE: Record<AtencionClienteKpiKey, VisualTone> =
  {
    atenciones_hoy: "blue",
    resueltas: "green",
    seguimientos_pendientes: "amber",
    retenciones_activas: "violet",
    recuperos_hoy: "orange",
  }

/**
 * Resueltas suma Atenciones con resultado `resuelta` del día más
 * Seguimientos completados hoy como resueltos por el empleado actual.
 * No incluye Retenciones finalizadas.
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
    case "retenciones_activas":
      return summary.retencionesActivas
    case "recuperos_hoy":
      return summary.recuperosHoy
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
    retenciones_activas: "retenciones_activas",
    recuperos_hoy: "mi_recupero",
  }

  return current === next[key] ? "none" : next[key]
}

export function mapDashboardFilterToJornadaFilter(
  filter: AtencionClienteDashboardFilter
): "all" | "atenciones" | "resueltas" | "retenciones" | "recuperos" {
  if (filter === "jornada_atenciones") {
    return "atenciones"
  }

  if (filter === "jornada_resueltas") {
    return "resueltas"
  }

  if (filter === "retenciones_activas") {
    return "all"
  }

  if (filter === "mi_recupero") {
    return "recuperos"
  }

  return "all"
}
