import "server-only"

import {
  aggregateCustomRange,
  aggregateDaily,
  aggregateMonthly,
  aggregateRolling,
  aggregateWeekly,
} from "@/lib/reporting-engine/aggregators"
import { listReportingDimensions } from "@/lib/reporting-engine/dimensions"
import {
  runDashboardHistoryQuery,
  runEmployeeReportQuery,
  runOperationalQuery,
  runProjectReportQuery,
} from "@/lib/reporting-engine/queries"
import {
  bootstrapMetricRegistry,
  computeMetric,
  getMetric,
  listRegisteredMetrics,
  registerMetric,
} from "@/lib/reporting-engine/registry"
import type {
  MetricResult,
  QueryOptions,
  ReportingMetricKey,
  ReportingPeriod,
  ReportingQueryResult,
  ReportContext,
} from "@/lib/reporting-engine/types"
import type { MetricComputeInput } from "@/lib/reporting-engine/metrics"

export type ReportingQueryInput = {
  companyId: string
  period: ReportingPeriod
  dimensions?: ReportContext["dimensions"]
  requestedByEmployeeId?: string | null
  limit?: number
  cursor?: string | null
}

function toQueryOptions(input: ReportingQueryInput): QueryOptions {
  return {
    context: {
      companyId: input.companyId,
      period: input.period,
      dimensions: input.dimensions,
      requestedByEmployeeId: input.requestedByEmployeeId ?? null,
    },
    limit: input.limit,
    cursor: input.cursor ?? null,
  }
}

/**
 * Public Reporting Engine facade (ADR-010).
 * Single entry point. Read-only. No side effects.
 */
export const reporting = {
  /** Bootstrap registry (safe to call repeatedly). */
  init() {
    bootstrapMetricRegistry()
  },

  getEmployeeReport(input: ReportingQueryInput): Promise<ReportingQueryResult> {
    return runEmployeeReportQuery(toQueryOptions(input))
  },

  getProjectReport(input: ReportingQueryInput): Promise<ReportingQueryResult> {
    return runProjectReportQuery(toQueryOptions(input))
  },

  getOperationalReport(
    input: ReportingQueryInput
  ): Promise<ReportingQueryResult> {
    return runOperationalQuery(toQueryOptions(input))
  },

  getDashboardHistory(
    input: ReportingQueryInput
  ): Promise<ReportingQueryResult> {
    return runDashboardHistoryQuery(toQueryOptions(input))
  },

  /**
   * Generic metric query against the canonical registry.
   * `dataset` must come from providers (or empty in Foundation).
   */
  query(
    metricKey: ReportingMetricKey | string,
    input: MetricComputeInput
  ): MetricResult {
    bootstrapMetricRegistry()
    return computeMetric(metricKey, input)
  },

  listMetrics() {
    bootstrapMetricRegistry()
    return listRegisteredMetrics()
  },

  getMetricDefinition(key: ReportingMetricKey | string) {
    bootstrapMetricRegistry()
    return getMetric(key)
  },

  registerMetric,

  listDimensions: listReportingDimensions,

  period: {
    daily: aggregateDaily,
    weekly: aggregateWeekly,
    monthly: aggregateMonthly,
    rolling: aggregateRolling,
    customRange: aggregateCustomRange,
  },
} as const
