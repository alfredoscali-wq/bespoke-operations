/**
 * Indicator Engine 2.0 — public contracts.
 * Snapshot model ownership: `lib/indicator-engine/snapshot`.
 */

export type { BusinessIndicator } from "@/lib/indicator-engine/contracts/business-indicator"
export type {
  BuildExecutiveBriefV2Input,
  ExecutiveBriefMetric,
  ExecutiveBriefOperationalAlert,
  ExecutiveBriefProductionBlock,
  ExecutiveBriefV2,
  ExecutiveBriefV2Builder,
} from "@/lib/indicator-engine/contracts/brief"
export type {
  BusinessDigest,
  BusinessDigestItem,
  DigestReader,
} from "@/lib/indicator-engine/contracts/digest"
export {
  assertBusinessDigestValidInDevelopment,
  validateBusinessDigest,
} from "@/lib/indicator-engine/contracts/digest"
export type { IndicatorContext } from "@/lib/indicator-engine/contracts/indicator-context"
export type {
  BusinessSnapshot,
  DailyIndicatorSnapshot,
  SnapshotIdentity,
  SnapshotIdentityLabel,
  SnapshotPayload,
  SnapshotReader,
  SnapshotScope,
  SnapshotStatus,
  SnapshotTimestamps,
  SnapshotUpdateMode,
} from "@/lib/indicator-engine/contracts/snapshot"
