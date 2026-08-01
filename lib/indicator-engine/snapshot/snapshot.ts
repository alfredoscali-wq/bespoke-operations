import type { SnapshotIdentity } from "@/lib/indicator-engine/snapshot/identity"
import type { SnapshotPayload } from "@/lib/indicator-engine/snapshot/payload"

/**
 * Official Business Snapshot — reusable photograph of prepared indicators
 * for one identity (company + date + scope + subject + version).
 *
 * Module-agnostic. Screens and Executive Brief 2.0 consume this artifact.
 * Never embeds Activity Events or Business Digest.
 *
 * Sprint 3: contract only — no persistence, no materialisation.
 */
export type BusinessSnapshot = {
  readonly identity: SnapshotIdentity
  readonly payload: SnapshotPayload
}

/**
 * Read port — implementation in a later sprint.
 * Not wired to any screen in Sprint 3.
 */
export type SnapshotReader = {
  getSnapshot(identity: SnapshotIdentity): Promise<BusinessSnapshot | null>
}

/**
 * @deprecated Use BusinessSnapshot. Alias kept for in-package Sprint 1/2 names.
 */
export type DailyIndicatorSnapshot = BusinessSnapshot
