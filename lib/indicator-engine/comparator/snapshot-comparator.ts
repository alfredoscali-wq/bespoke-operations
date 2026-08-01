import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import {
  finalizeFieldResult,
  issue,
  noteTolerance,
  valuesEqual,
} from "@/lib/indicator-engine/comparator/compare-utils"
import type {
  ComparableIndicatorMap,
  ComparableSnapshotView,
  ComparisonIssue,
  ComparisonTolerance,
  FieldComparisonResult,
} from "@/lib/indicator-engine/comparator/types"

/** IE 1.x IndicatorSnapshot duck type. */
export type LegacyIndicatorSnapshotLike = {
  readonly values: Readonly<Record<string, IndicatorValue>>
}

export function snapshotViewFromLegacy(
  snapshot: LegacyIndicatorSnapshotLike
): ComparableSnapshotView {
  return { indicators: snapshot.values }
}

export function snapshotViewFromBusiness(
  snapshot: BusinessSnapshot
): ComparableSnapshotView {
  return {
    indicators: snapshot.payload.indicators,
    status: snapshot.payload.status,
  }
}

/**
 * SnapshotComparator — business indicator values (+ optional status).
 * Ignores identity UUIDs, timestamps, metadata, updateMode, versions.
 */
export function compareSnapshots(
  legacy: ComparableSnapshotView | LegacyIndicatorSnapshotLike,
  next: ComparableSnapshotView | BusinessSnapshot,
  tolerance?: ComparisonTolerance
): FieldComparisonResult {
  try {
    noteTolerance(tolerance)
    const started = performance.now()

    const left: ComparableIndicatorMap =
      "indicators" in legacy
        ? legacy.indicators
        : snapshotViewFromLegacy(legacy).indicators

    const rightView =
      "payload" in next
        ? snapshotViewFromBusiness(next)
        : (next as ComparableSnapshotView)
    const right = rightView.indicators

    const differences: ComparisonIssue[] = []
    const missing: ComparisonIssue[] = []
    const unexpected: ComparisonIssue[] = []
    let comparedFields = 0
    let matchedFields = 0

    const leftKeys = new Set(Object.keys(left))
    const rightKeys = new Set(Object.keys(right))
    const allKeys = [...new Set([...leftKeys, ...rightKeys])].sort()

    for (const key of allKeys) {
      const path = `indicators.${key}`
      const hasLeft = leftKeys.has(key)
      const hasRight = rightKeys.has(key)

      if (hasLeft && !hasRight) {
        missing.push(issue(path, left[key], undefined))
        comparedFields += 1
        continue
      }
      if (!hasLeft && hasRight) {
        unexpected.push(issue(path, undefined, right[key]))
        comparedFields += 1
        continue
      }

      comparedFields += 1
      if (valuesEqual(left[key], right[key])) {
        matchedFields += 1
      } else {
        differences.push(issue(path, left[key], right[key]))
      }
    }

    // Status is compared only when both sides declare it (business state).
    if (
      "status" in legacy &&
      typeof (legacy as ComparableSnapshotView).status === "string" &&
      typeof rightView.status === "string"
    ) {
      comparedFields += 1
      const expected = (legacy as ComparableSnapshotView).status
      const actual = rightView.status
      if (valuesEqual(expected, actual)) {
        matchedFields += 1
      } else {
        differences.push(issue("status", expected, actual))
      }
    }

    return finalizeFieldResult({
      differences,
      missing,
      unexpected,
      comparedFields,
      matchedFields,
      started,
    })
  } catch {
    return {
      match: false,
      differences: [
        issue("snapshot", "comparison_failed", "comparison_failed"),
      ],
      missing: [],
      unexpected: [],
      comparisonTimeMs: 0,
      coverage: { comparedFields: 0, matchedFields: 0, ratio: 0 },
    }
  }
}

export const snapshotComparator = {
  compare: compareSnapshots,
  fromLegacy: snapshotViewFromLegacy,
  fromBusiness: snapshotViewFromBusiness,
} as const
