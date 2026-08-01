import { compareExecutiveBriefs } from "@/lib/indicator-engine/comparator/brief-comparator"
import { compareDigests } from "@/lib/indicator-engine/comparator/digest-comparator"
import { compareSnapshots } from "@/lib/indicator-engine/comparator/snapshot-comparator"
import { noteTolerance } from "@/lib/indicator-engine/comparator/compare-utils"
import type {
  ComparableBriefView,
  ComparableDigestView,
  ComparableSnapshotView,
  ComparisonReport,
  ComparisonTolerance,
  FieldComparisonResult,
} from "@/lib/indicator-engine/comparator/types"
import type { BusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { LegacyExecutiveBriefLike } from "@/lib/indicator-engine/comparator/brief-comparator"
import type { LegacyIndicatorSnapshotLike } from "@/lib/indicator-engine/comparator/snapshot-comparator"
import { isComparatorEnabled } from "@/lib/indicator-engine/feature-flags"
import { hookComparatorTelemetry } from "@/lib/indicator-engine/telemetry/hooks"

const EMPTY_FIELD_RESULT: FieldComparisonResult = {
  match: true,
  differences: [],
  missing: [],
  unexpected: [],
  comparisonTimeMs: 0,
  coverage: { comparedFields: 0, matchedFields: 0, ratio: 1 },
}

function skippedComparisonReport(now?: string): ComparisonReport {
  return {
    match: true,
    snapshot: { ...EMPTY_FIELD_RESULT },
    digest: { ...EMPTY_FIELD_RESULT },
    brief: { ...EMPTY_FIELD_RESULT },
    comparisonTimeMs: 0,
    coverage: { comparedFields: 0, matchedFields: 0, ratio: 1 },
    generatedAt: now ?? new Date().toISOString(),
  }
}

export type BuildComparisonReportInput = {
  readonly legacySnapshot: ComparableSnapshotView | LegacyIndicatorSnapshotLike
  readonly nextSnapshot: ComparableSnapshotView | BusinessSnapshot
  readonly legacyDigest: ComparableDigestView
  readonly nextDigest: ComparableDigestView | BusinessDigest
  readonly legacyBrief: ComparableBriefView | LegacyExecutiveBriefLike
  readonly nextBrief: ComparableBriefView | ExecutiveBriefV2
  readonly tolerance?: ComparisonTolerance
  readonly now?: string
}

/**
 * Builds an in-memory ComparisonReport. Never throws. Never persists.
 * Gated exclusively by Feature Flags (Sprint 13).
 */
export function buildComparisonReport(
  input: BuildComparisonReportInput
): ComparisonReport {
  if (!isComparatorEnabled()) {
    return skippedComparisonReport(input.now)
  }

  try {
    noteTolerance(input.tolerance)
    const started = performance.now()

    const snapshot = compareSnapshots(
      input.legacySnapshot,
      input.nextSnapshot,
      input.tolerance
    )
    const digest = compareDigests(
      input.legacyDigest,
      input.nextDigest,
      input.tolerance
    )
    const brief = compareExecutiveBriefs(
      input.legacyBrief,
      input.nextBrief,
      input.tolerance
    )

    const comparedFields =
      snapshot.coverage.comparedFields +
      digest.coverage.comparedFields +
      brief.coverage.comparedFields
    const matchedFields =
      snapshot.coverage.matchedFields +
      digest.coverage.matchedFields +
      brief.coverage.matchedFields

    const report: ComparisonReport = {
      match: snapshot.match && digest.match && brief.match,
      snapshot,
      digest,
      brief,
      comparisonTimeMs: Math.max(0, performance.now() - started),
      coverage: {
        comparedFields,
        matchedFields,
        ratio:
          comparedFields === 0
            ? 1
            : matchedFields / Math.max(1, comparedFields),
      },
      generatedAt: input.now ?? new Date().toISOString(),
    }

    hookComparatorTelemetry(report)
    return report
  } catch {
    const report: ComparisonReport = {
      match: false,
      snapshot: {
        match: false,
        differences: [],
        missing: [],
        unexpected: [],
        comparisonTimeMs: 0,
        coverage: { comparedFields: 0, matchedFields: 0, ratio: 0 },
      },
      digest: {
        match: false,
        differences: [],
        missing: [],
        unexpected: [],
        comparisonTimeMs: 0,
        coverage: { comparedFields: 0, matchedFields: 0, ratio: 0 },
      },
      brief: {
        match: false,
        differences: [],
        missing: [],
        unexpected: [],
        comparisonTimeMs: 0,
        coverage: { comparedFields: 0, matchedFields: 0, ratio: 0 },
      },
      comparisonTimeMs: 0,
      coverage: { comparedFields: 0, matchedFields: 0, ratio: 0 },
      generatedAt: input.now ?? new Date().toISOString(),
    }
    hookComparatorTelemetry(report)
    return report
  }
}
