/**
 * Indicator Engine 2.0 — in-memory Snapshot Engine (Sprint 5).
 * No Supabase, no persistence, no Activity Event reads.
 */

export {
  createBrief,
  executiveBriefV2Builder,
} from "@/lib/indicator-engine/engine/brief-builder"
export {
  createDigest,
  DEFAULT_DIGEST_LIMIT,
  type CreateDigestInput,
} from "@/lib/indicator-engine/engine/digest-builder"
export {
  createSnapshot,
  type CreateSnapshotInput,
} from "@/lib/indicator-engine/engine/snapshot-builder"
export {
  snapshotEngine,
  type SnapshotEngine,
  type SnapshotEngineBuildInput,
  type SnapshotEngineBuildOutput,
} from "@/lib/indicator-engine/engine/snapshot-engine"
export {
  assertExecutiveBriefValidInDevelopment,
  validateExecutiveBrief,
} from "@/lib/indicator-engine/engine/validate-brief"
