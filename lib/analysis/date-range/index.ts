/**
 * Official Análisis date-range helpers — Sprint 26.
 */

export {
  formatAnalysisDateRangeTriggerLabel,
  formatAnalysisDateShort,
} from "@/lib/analysis/date-range/format"

export {
  analysisDateRangeFocusDate,
  createDefaultAnalysisDateRange,
  parseAnalysisDateOnly,
  resolveAnalysisDateRange,
  toAnalysisDateOnly,
} from "@/lib/analysis/date-range/resolve"

export {
  ANALYSIS_DATE_RANGE_PRESET_OPTIONS,
  type AnalysisDateRangePreset,
  type AnalysisDateRangeValue,
} from "@/lib/analysis/date-range/types"

export {
  analysisDateRangeToReportFilters,
  reportFiltersToAnalysisDateRange,
} from "@/lib/analysis/date-range/report-bridge"
