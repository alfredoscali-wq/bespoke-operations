/**
 * Snapshot package — official Indicator Engine 2.0 snapshot model (Sprint 3).
 * Contracts only: no persistence, no Supabase, no materialisation.
 */

export type {
  SnapshotIdentity,
  SnapshotIdentityLabel,
} from "@/lib/indicator-engine/snapshot/identity"

export type {
  SnapshotPayload,
  SnapshotTimestamps,
  SnapshotUpdateMode,
} from "@/lib/indicator-engine/snapshot/payload"
export { SNAPSHOT_UPDATE_MODES } from "@/lib/indicator-engine/snapshot/payload"

export {
  getSnapshotScopeTier,
  isSnapshotScope,
  SNAPSHOT_SCOPE_TIERS,
  SNAPSHOT_SCOPES,
  SNAPSHOT_SCOPES_P0,
  SNAPSHOT_SCOPES_P1,
  snapshotScopeRequiresSubject,
  type SnapshotScope,
  type SnapshotScopeTier,
} from "@/lib/indicator-engine/snapshot/scope"

export type {
  BusinessSnapshot,
  DailyIndicatorSnapshot,
  SnapshotReader,
} from "@/lib/indicator-engine/snapshot/snapshot"

export {
  isSnapshotStatus,
  SNAPSHOT_STATUSES,
  type SnapshotStatus,
} from "@/lib/indicator-engine/snapshot/status"

export {
  assertBusinessSnapshotValidInDevelopment,
  validateBusinessSnapshot,
  validateSnapshotIdentity,
  validateSnapshotPayload,
} from "@/lib/indicator-engine/snapshot/validate-snapshot"
