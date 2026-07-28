/**
 * Reporting Engine — shared types (read-only analytics).
 * ADR-010: never writes, never mutates, never records events.
 */

export type ReportingPeriodKind =
  | "daily"
  | "weekly"
  | "monthly"
  | "rolling"
  | "custom-range"

/** Inclusive calendar/instant bounds for a reporting window. */
export type ReportingRange = {
  from: string
  to: string
  /** IANA timezone used to interpret calendar boundaries. */
  timeZone?: string
}

export type ReportingPeriod = {
  kind: ReportingPeriodKind
  range: ReportingRange
  /** For rolling: number of days ending at `range.to`. */
  rollingDays?: number
}

export const REPORTING_DIMENSION_KEYS = [
  "employee",
  "crew",
  "project",
  "customer",
  "serviceType",
  "locality",
  "technology",
  "status",
  "date",
] as const

export type ReportingDimensionKey = (typeof REPORTING_DIMENSION_KEYS)[number]

/** Sparse dimension bag used by queries and metric cuts. */
export type ReportingDimensions = Partial<
  Record<ReportingDimensionKey, string | null>
>

export type ReportingMetricKey =
  | "compliance"
  | "productivity"
  | "effective-time"
  | "activity-facts"

export type MetricResultStatus = "ok" | "empty" | "not_implemented"

export type MetricResult<TValue = unknown> = {
  metricKey: ReportingMetricKey | string
  status: MetricResultStatus
  value: TValue | null
  dimensions?: ReportingDimensions
  period?: ReportingPeriod
  message?: string
}

export type ReportContext = {
  companyId: string
  period: ReportingPeriod
  dimensions?: ReportingDimensions
  /** Optional actor for audit of reads later — never used to write. */
  requestedByEmployeeId?: string | null
}

export type QueryOptions = {
  context: ReportContext
  /** Limit rows for list-shaped results. */
  limit?: number
  /** Opaque cursor for future pagination. */
  cursor?: string | null
}

export type ReportingQueryResultStatus = "ok" | "empty" | "not_implemented"

export type ReportingQueryResult<TData = unknown> = {
  status: ReportingQueryResultStatus
  data: TData | null
  message?: string
  context: ReportContext
}

export type ReportingQueryKey =
  | "employee-report"
  | "project-report"
  | "operational"
  | "dashboard-history"
