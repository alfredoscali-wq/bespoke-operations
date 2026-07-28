/**
 * Reporting Engine — canonical analytics read layer (ADR-010).
 *
 * - Only reads / interprets.
 * - Never writes, mutates, records Activity/Presence, sends email, or builds PDFs.
 * - Single public entry: `reporting`.
 *
 * Foundation 1.0: infrastructure + registry. Queries return not_implemented
 * until Sprint 2 wires providers to real datasets.
 *
 * Public surface: `reporting` + types needed to call it.
 * Registry, aggregators, metrics implementations, and dimension helpers stay
 * internal (reachable via `reporting.*` or deep imports if ever required).
 */

export { reporting } from "@/lib/reporting-engine/reporting-engine"
export type { ReportingQueryInput } from "@/lib/reporting-engine/reporting-engine"

export type {
  MetricResult,
  ReportContext,
  ReportingDimensionKey,
  ReportingDimensions,
  ReportingMetricKey,
  ReportingPeriod,
  ReportingPeriodKind,
  ReportingQueryKey,
  ReportingQueryResult,
  ReportingQueryResultStatus,
  ReportingRange,
} from "@/lib/reporting-engine/types"

export type {
  MetricComputeInput,
  ReportingMetricDefinition,
} from "@/lib/reporting-engine/metrics"
