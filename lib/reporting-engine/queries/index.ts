import "server-only"

import { assertValidPeriod, notImplementedQueryResult } from "@/lib/reporting-engine/internal/errors"
import { pickReportingDimensions } from "@/lib/reporting-engine/dimensions"
import { bootstrapMetricRegistry } from "@/lib/reporting-engine/registry"
import type {
  QueryOptions,
  ReportingQueryResult,
} from "@/lib/reporting-engine/types"

/**
 * Queries orchestrate providers + metrics + aggregators + dimensions.
 * Foundation 1.0: structure only — returns not_implemented.
 * No SQL inside queries.
 */

function prepare(options: QueryOptions): QueryOptions {
  bootstrapMetricRegistry()
  assertValidPeriod(options.context.period)
  return {
    ...options,
    context: {
      ...options.context,
      dimensions: pickReportingDimensions(options.context.dimensions),
    },
  }
}

export async function runEmployeeReportQuery(
  options: QueryOptions
): Promise<ReportingQueryResult> {
  const prepared = prepare(options)
  return notImplementedQueryResult(prepared.context, "getEmployeeReport")
}

export async function runProjectReportQuery(
  options: QueryOptions
): Promise<ReportingQueryResult> {
  const prepared = prepare(options)
  return notImplementedQueryResult(prepared.context, "getProjectReport")
}

export async function runOperationalQuery(
  options: QueryOptions
): Promise<ReportingQueryResult> {
  const prepared = prepare(options)
  return notImplementedQueryResult(prepared.context, "getOperationalReport")
}

export async function runDashboardHistoryQuery(
  options: QueryOptions
): Promise<ReportingQueryResult> {
  const prepared = prepare(options)
  return notImplementedQueryResult(prepared.context, "getDashboardHistory")
}
