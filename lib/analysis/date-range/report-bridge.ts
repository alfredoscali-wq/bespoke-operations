/**
 * Map official Análisis date-range → Reportes Operativos filters.
 * Always materializes inclusive start/end as custom so the exact range is applied.
 */

import {
  createDefaultAnalysisDateRange,
  resolveAnalysisDateRange,
} from "@/lib/analysis/date-range/resolve"
import type { AnalysisDateRangeValue } from "@/lib/analysis/date-range/types"
import type { ReportFilters } from "@/lib/reports/report-filters"

export function analysisDateRangeToReportFilters(
  range: AnalysisDateRangeValue,
  current: ReportFilters
): ReportFilters {
  return {
    ...current,
    period: "custom",
    startDate: range.dateFrom,
    endDate: range.dateTo,
  }
}

export function reportFiltersToAnalysisDateRange(
  filters: ReportFilters
): AnalysisDateRangeValue {
  const from = filters.startDate?.trim()
  const to = filters.endDate?.trim()

  if (from && to) {
    return resolveAnalysisDateRange({
      preset: "custom",
      dateFrom: from,
      dateTo: to,
    })
  }

  if (filters.period === "today") {
    return resolveAnalysisDateRange({ preset: "today" })
  }
  if (filters.period === "last30") {
    return resolveAnalysisDateRange({ preset: "last_30_days" })
  }
  if (filters.period === "month") {
    return resolveAnalysisDateRange({ preset: "this_month" })
  }
  if (filters.period === "week") {
    return resolveAnalysisDateRange({ preset: "last_7_days" })
  }

  return createDefaultAnalysisDateRange()
}
