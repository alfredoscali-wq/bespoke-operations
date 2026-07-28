import type {
  MetricResult,
  ReportingDimensions,
  ReportingMetricKey,
  ReportingPeriod,
} from "@/lib/reporting-engine/types"

/**
 * Canonical metric modules receive provider datasets — never query SQL.
 * Foundation 1.0: minimal / not_implemented until Sprint 2 wiring.
 */

export type MetricComputeInput = {
  period: ReportingPeriod
  dimensions?: ReportingDimensions
  /** Opaque datasets from providers (shape evolves per metric). */
  dataset: unknown
}

export type ReportingMetricDefinition = {
  key: ReportingMetricKey
  label: string
  description: string
  compute: (input: MetricComputeInput) => MetricResult
}

function notImplementedResult(
  metricKey: ReportingMetricKey,
  input: MetricComputeInput,
  label: string
): MetricResult {
  return {
    metricKey,
    status: "not_implemented",
    value: null,
    dimensions: input.dimensions,
    period: input.period,
    message: `${label}: implementación mínima Foundation 1.0 — pendiente de datasets reales.`,
  }
}

export const complianceMetric: ReportingMetricDefinition = {
  key: "compliance",
  label: "Cumplimiento",
  description:
    "Relación entre órdenes programadas y completadas en un período (dominio OT).",
  compute: (input) => notImplementedResult("compliance", input, "Cumplimiento"),
}

export const productivityMetric: ReportingMetricDefinition = {
  key: "productivity",
  label: "Productividad",
  description:
    "Productividad operativa por dimensiones (p. ej. cuadrilla / empleado).",
  compute: (input) =>
    notImplementedResult("productivity", input, "Productividad"),
}

export const effectiveTimeMetric: ReportingMetricDefinition = {
  key: "effective-time",
  label: "Tiempo efectivo",
  description:
    "Tiempo efectivo en radio a partir de hechos Presence ENTER/EXIT (no HEARTBEAT).",
  compute: (input) =>
    notImplementedResult("effective-time", input, "Tiempo efectivo"),
}

export const activityFactsMetric: ReportingMetricDefinition = {
  key: "activity-facts",
  label: "Hechos de Activity",
  description:
    "Agregación de hechos de negocio desde Activity Engine para un período.",
  compute: (input) =>
    notImplementedResult("activity-facts", input, "Hechos de Activity"),
}

export const CANONICAL_METRICS: ReportingMetricDefinition[] = [
  complianceMetric,
  productivityMetric,
  effectiveTimeMetric,
  activityFactsMetric,
]
