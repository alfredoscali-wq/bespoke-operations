/**
 * Analysis units for Indicator Engine 2.0.
 * Aligned with the product scopes used by executive views.
 */

export type IndicatorAnalysisUnit =
  | "company"
  | "employee"
  | "crew"
  | "project"
  | "customer"

export type IndicatorMeasureUnit = "count" | "milliseconds" | "timestamp_iso"

export type IndicatorValue = number | string | null
