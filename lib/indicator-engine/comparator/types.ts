import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"

/**
 * Structural views for comparison — duck-typed so IE 1.x / 2.0 objects
 * can be passed without importing those packages into product call sites.
 */

export type ComparableIndicatorMap = Readonly<Record<string, IndicatorValue>>

export type ComparableMetric = {
  readonly id: string
  readonly label: string
  readonly value: number
}

export type ComparableProductionBlock = {
  readonly id: string
  readonly title: string
  readonly metrics: readonly ComparableMetric[]
}

export type ComparableDigestItem = {
  readonly action: string
  readonly title: string
  readonly description: string | null
  readonly entityType: string
  /** entityId compared when both sides present; ids/UUIDs of items ignored. */
  readonly entityId: string | null
}

export type ComparableSnapshotView = {
  readonly indicators: ComparableIndicatorMap
  readonly status?: string
}

export type ComparableDigestView = {
  readonly items: readonly ComparableDigestItem[]
}

export type ComparableBriefView = {
  readonly date: string
  readonly narrative: string
  readonly generalState: readonly ComparableMetric[]
  readonly production: readonly ComparableProductionBlock[]
  readonly operationalAlerts: readonly ComparableMetric[]
  readonly relevantActivity: readonly ComparableDigestItem[]
  readonly firstEventAt: string | null
  readonly lastEventAt: string | null
  readonly activeTimeMs: number
  readonly indicators: ComparableIndicatorMap
}

/**
 * Tolerance hooks for future rules (Sprint 9: structure only — not applied).
 */
export type ComparisonTolerance = {
  /** When true, array order must not affect match (future). */
  readonly ignoreArrayOrder?: boolean
  /** Numeric absolute epsilon for rounded values (future). */
  readonly numericEpsilon?: number
  /** Field paths treated as optional (future). */
  readonly optionalFields?: readonly string[]
}

export type ComparisonIssue = {
  readonly path: string
  readonly expected: unknown
  readonly actual: unknown
}

export type FieldComparisonResult = {
  readonly match: boolean
  readonly differences: readonly ComparisonIssue[]
  readonly missing: readonly ComparisonIssue[]
  readonly unexpected: readonly ComparisonIssue[]
  readonly comparisonTimeMs: number
  readonly coverage: {
    readonly comparedFields: number
    readonly matchedFields: number
    readonly ratio: number
  }
}

export type ComparisonReport = {
  readonly match: boolean
  readonly snapshot: FieldComparisonResult
  readonly digest: FieldComparisonResult
  readonly brief: FieldComparisonResult
  readonly comparisonTimeMs: number
  readonly coverage: {
    readonly comparedFields: number
    readonly matchedFields: number
    readonly ratio: number
  }
  readonly generatedAt: string
}
