import {
  CANONICAL_METRICS,
  type MetricComputeInput,
  type ReportingMetricDefinition,
} from "@/lib/reporting-engine/metrics"
import type {
  MetricResult,
  ReportingMetricKey,
} from "@/lib/reporting-engine/types"

/**
 * Central metric registry — single catalog for Reportes, Automation e IA.
 * Registration by map; no large switch statements.
 */
const metricRegistry = new Map<string, ReportingMetricDefinition>()

function ensureCanonicalRegistered(): void {
  if (metricRegistry.size > 0) {
    return
  }
  for (const metric of CANONICAL_METRICS) {
    metricRegistry.set(metric.key, metric)
  }
}

export function registerMetric(definition: ReportingMetricDefinition): void {
  ensureCanonicalRegistered()
  metricRegistry.set(definition.key, definition)
}

export function getMetric(
  key: ReportingMetricKey | string
): ReportingMetricDefinition | null {
  ensureCanonicalRegistered()
  return metricRegistry.get(key) ?? null
}

export function listRegisteredMetrics(): ReportingMetricDefinition[] {
  ensureCanonicalRegistered()
  return [...metricRegistry.values()]
}

export function computeMetric(
  key: ReportingMetricKey | string,
  input: MetricComputeInput
): MetricResult {
  const metric = getMetric(key)
  if (!metric) {
    return {
      metricKey: key,
      status: "not_implemented",
      value: null,
      dimensions: input.dimensions,
      period: input.period,
      message: `Métrica no registrada en el Reporting Engine: ${key}`,
    }
  }
  return metric.compute(input)
}

/** Bootstrap canonical metrics (idempotent). */
export function bootstrapMetricRegistry(): void {
  ensureCanonicalRegistered()
}
