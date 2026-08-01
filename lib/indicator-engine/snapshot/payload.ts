import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import type { SnapshotStatus } from "@/lib/indicator-engine/snapshot/status"

/**
 * How values were last produced (metadata only — no behaviour here).
 */
export const SNAPSHOT_UPDATE_MODES = [
  "incremental",
  "reconcile",
  "close",
  "bootstrap",
] as const

export type SnapshotUpdateMode = (typeof SNAPSHOT_UPDATE_MODES)[number]

export type SnapshotTimestamps = {
  /** When the snapshot record was first created. */
  readonly createdAt: string
  /** When the snapshot was last written. */
  readonly updatedAt: string
  /** When indicators were last fully calculated (null if never ready). */
  readonly calculatedAt: string | null
}

/**
 * Snapshot payload — business data only.
 *
 * Does NOT include Business Digest (narrative). Digest is a separate artifact
 * correlated by SnapshotIdentity.
 */
export type SnapshotPayload = {
  /** Indicator id → value. */
  readonly indicators: Readonly<Record<string, IndicatorValue>>
  readonly status: SnapshotStatus
  readonly timestamps: SnapshotTimestamps
  /** Opaque extension bag for future engine metadata. */
  readonly metadata: Readonly<Record<string, unknown>>
  /** Payload / catalog version used to produce `indicators`. */
  readonly version: string
  /** Optional last update mode (engine bookkeeping). */
  readonly updateMode?: SnapshotUpdateMode
}
