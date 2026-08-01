/**
 * Official lifecycle states for a Business Snapshot.
 * Behaviour / transitions land in a later sprint — contract only.
 */

export const SNAPSHOT_STATUSES = [
  "pending",
  "calculating",
  "ready",
  "reconciled",
  "invalid",
] as const

export type SnapshotStatus = (typeof SNAPSHOT_STATUSES)[number]

export function isSnapshotStatus(value: string): value is SnapshotStatus {
  return (SNAPSHOT_STATUSES as readonly string[]).includes(value)
}
