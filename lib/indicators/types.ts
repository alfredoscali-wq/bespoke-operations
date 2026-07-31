/**
 * Indicator Engine — types.
 *
 * Activity Engine records events.
 * Indicator Engine turns events into business indicators.
 * Reports must consume indicators, never raw event.module rules.
 */

export type IndicatorAnalysisUnit =
  | "employee"
  | "crew"
  | "project"
  | "customer"
  | "company"

export type IndicatorMeasureUnit =
  | "count"
  | "milliseconds"
  | "timestamp_iso"

/**
 * How an indicator is derived from a filtered event set.
 * Rules live only in the catalog + compute service — not in screens.
 */
export type IndicatorCalculation =
  | "count_matching_events"
  | "count_distinct_entity_ids"
  | "count_distinct_employee_ids"
  | "count_distinct_canonical_modules"
  | "min_created_at"
  | "max_created_at"
  | "span_first_to_last_ms"

export type IndicatorDefinition = {
  id: string
  name: string
  description: string
  unit: IndicatorMeasureUnit
  calculation: IndicatorCalculation
  /**
   * Canonical modules that feed this indicator (after alias normalization).
   * Empty / omitted = no module constraint.
   */
  modules?: readonly string[]
  /**
   * Actions that feed this indicator (canonical AE + legacy CS actions).
   * Empty / omitted = no action constraint.
   */
  actions?: readonly string[]
  /**
   * Optional entity_type filter (OR). Used for active crews / projects.
   */
  entityTypes?: readonly string[]
  /** Analysis units this indicator is valid for. */
  analysisUnits: readonly IndicatorAnalysisUnit[]
  /**
   * Optional metadata equality filters (all must match when present on the event).
   * Used for fine-grained production indicators (e.g. retenciones).
   */
  metadataEquals?: Readonly<Record<string, string>>
}

/** Minimal event shape accepted by the Indicator Engine. */
export type IndicatorSourceEvent = {
  id?: string
  module: string
  action: string
  entityType?: string
  entityId?: string | null
  employeeId?: string | null
  createdAt: string
  metadata?: Record<string, unknown>
  title?: string | null
  description?: string | null
}

export type IndicatorValue = number | string | null

export type IndicatorSnapshot = {
  /** Values keyed by indicator id. Missing keys mean 0 / null per unit. */
  values: Record<string, IndicatorValue>
}

export type ComputeIndicatorsOptions = {
  /** Subset of catalog ids. Defaults to full catalog. */
  indicatorIds?: readonly string[]
}
