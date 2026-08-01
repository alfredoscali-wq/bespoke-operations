/**
 * Baseline screens for Bloque D / Sprint 14.
 * Only these four executive surfaces are in scope.
 */

export const BASELINE_SCREEN_IDS = [
  "sala_situacion",
  "workforce_monitor",
  "actividad_jornada",
  "reportes_operativos",
] as const

export type BaselineScreenId = (typeof BASELINE_SCREEN_IDS)[number]

export const BASELINE_SCREEN_LABELS: Readonly<
  Record<BaselineScreenId, string>
> = {
  sala_situacion: "Sala de Situación",
  workforce_monitor: "Workforce Monitor",
  actividad_jornada: "Actividad de la Jornada",
  reportes_operativos: "Reportes Operativos",
}

export function isBaselineScreenId(value: string): value is BaselineScreenId {
  return (BASELINE_SCREEN_IDS as readonly string[]).includes(value)
}

/**
 * Maps Sprint 11 telemetry sources that belong to Sala dual-read / facade.
 */
export function telemetrySourceToBaselineScreen(
  source: string
): BaselineScreenId | null {
  if (source === "dual_read" || source === "facade") {
    return "sala_situacion"
  }
  return null
}
