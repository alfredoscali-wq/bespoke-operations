/**
 * Period helpers for CUADRILLAS — Sprint 26.
 * Thin adapter over the official Análisis date-range model.
 * OT filtering uses due_date (see load-sources.server).
 */

import {
  analysisDateRangeFocusDate,
  resolveAnalysisDateRange,
  type AnalysisDateRangePreset,
  type AnalysisDateRangeValue,
} from "@/lib/analysis/date-range"

export type CrewsPeriodPreset = AnalysisDateRangePreset

export type CrewsPeriodRange = AnalysisDateRangeValue & {
  /** Focus date for Executive Brief / day timeline narrative. */
  focusDate: string
}

export function resolveCrewsPeriodRange(input: {
  preset: CrewsPeriodPreset
  dateFrom?: string | null
  dateTo?: string | null
  referenceDate?: string | Date
}): CrewsPeriodRange {
  const value = resolveAnalysisDateRange({
    preset: input.preset,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    referenceDate: input.referenceDate,
  })

  return {
    ...value,
    focusDate: analysisDateRangeFocusDate(value),
  }
}
