/**
 * Indicator Engine comparators — IE 1.x vs IE 2.0 (Sprint 9).
 * In-memory only. Never throws to callers. No persistence / logs.
 */

export type {
  ComparableBriefView,
  ComparableDigestItem,
  ComparableDigestView,
  ComparableIndicatorMap,
  ComparableMetric,
  ComparableProductionBlock,
  ComparableSnapshotView,
  ComparisonIssue,
  ComparisonReport,
  ComparisonTolerance,
  FieldComparisonResult,
} from "@/lib/indicator-engine/comparator/types"

export {
  compareSnapshots,
  snapshotComparator,
  snapshotViewFromBusiness,
  snapshotViewFromLegacy,
  type LegacyIndicatorSnapshotLike,
} from "@/lib/indicator-engine/comparator/snapshot-comparator"

export {
  businessDigestComparator,
  compareDigests,
  digestViewFromBusiness,
  digestViewFromLegacyActivity,
} from "@/lib/indicator-engine/comparator/digest-comparator"

export {
  briefViewFromLegacy,
  briefViewFromV2,
  compareExecutiveBriefs,
  executiveBriefComparator,
  type LegacyExecutiveBriefLike,
} from "@/lib/indicator-engine/comparator/brief-comparator"

export {
  buildComparisonReport,
  type BuildComparisonReportInput,
} from "@/lib/indicator-engine/comparator/comparison-report"
