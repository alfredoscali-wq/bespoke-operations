/**
 * @deprecated Snapshot contracts live under `lib/indicator-engine/snapshot`.
 * Re-exports kept so older in-package imports keep resolving.
 */

export type {
  BusinessSnapshot,
  DailyIndicatorSnapshot,
  SnapshotReader,
} from "@/lib/indicator-engine/snapshot/snapshot"
export type {
  SnapshotIdentity,
  SnapshotIdentityLabel,
} from "@/lib/indicator-engine/snapshot/identity"
export type {
  SnapshotPayload,
  SnapshotTimestamps,
  SnapshotUpdateMode,
} from "@/lib/indicator-engine/snapshot/payload"
export type { SnapshotScope } from "@/lib/indicator-engine/snapshot/scope"
export type { SnapshotStatus } from "@/lib/indicator-engine/snapshot/status"
