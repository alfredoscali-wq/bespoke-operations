/**
 * Display labels for AnalysisDateRangePicker.
 */

import { parseAnalysisDateOnly } from "@/lib/analysis/date-range/resolve"
import type { AnalysisDateRangeValue } from "@/lib/analysis/date-range/types"
import { ANALYSIS_DATE_RANGE_PRESET_OPTIONS } from "@/lib/analysis/date-range/types"

const MONTHS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

export function formatAnalysisDateShort(value: string): string {
  const date = parseAnalysisDateOnly(value)
  const day = String(date.getDate()).padStart(2, "0")
  const month = MONTHS_SHORT[date.getMonth()] ?? "—"
  return `${day} ${month}`
}

export function formatAnalysisDateRangeTriggerLabel(
  value: AnalysisDateRangeValue,
  referenceToday?: string
): string {
  if (value.preset !== "custom") {
    return (
      ANALYSIS_DATE_RANGE_PRESET_OPTIONS.find(
        (option) => option.value === value.preset
      )?.label ?? "Período"
    )
  }

  const today = referenceToday?.trim()
  const fromLabel = formatAnalysisDateShort(value.dateFrom)
  const toLabel =
    today && value.dateTo === today
      ? "Hoy"
      : formatAnalysisDateShort(value.dateTo)

  return `${fromLabel} → ${toLabel}`
}
