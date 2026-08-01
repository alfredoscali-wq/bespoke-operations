/**
 * Official Análisis date-range model — Sprint 26.
 * Local calendar dates only (YYYY-MM-DD). No timezone shift via UTC midnight.
 */

export type AnalysisDateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "custom"

export type AnalysisDateRangeValue = {
  preset: AnalysisDateRangePreset
  /** Inclusive start YYYY-MM-DD */
  dateFrom: string
  /** Inclusive end YYYY-MM-DD */
  dateTo: string
}

export const ANALYSIS_DATE_RANGE_PRESET_OPTIONS: ReadonlyArray<{
  value: AnalysisDateRangePreset
  label: string
}> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
  { value: "custom", label: "Personalizado…" },
]
