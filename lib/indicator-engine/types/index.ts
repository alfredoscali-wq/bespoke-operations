/**
 * Indicator Engine 2.0 — shared primitive types.
 */

export type {
  IndicatorAnalysisUnit,
  IndicatorMeasureUnit,
  IndicatorValue,
} from "@/lib/indicator-engine/types/analysis-unit"

export type {
  BusinessIndicatorCategory,
  BusinessIndicatorOrigin,
  BusinessIndicatorOwner,
  BusinessIndicatorStatus,
} from "@/lib/indicator-engine/types/indicator-meta"

export {
  BUSINESS_INDICATOR_CATEGORIES,
  BUSINESS_INDICATOR_ORIGINS,
  BUSINESS_INDICATOR_OWNERS,
  BUSINESS_INDICATOR_STATUSES,
} from "@/lib/indicator-engine/types/indicator-meta"

/** Business calendar date as YYYY-MM-DD in the company timezone. */
export type BusinessDate = string

/** Opaque stable indicator identifier (catalog id). */
export type BusinessIndicatorId = string

/** Re-export snapshot status / update mode for a single types barrel. */
export type { SnapshotStatus } from "@/lib/indicator-engine/snapshot/status"
export type { SnapshotUpdateMode } from "@/lib/indicator-engine/snapshot/payload"
