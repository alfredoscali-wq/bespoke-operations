import type { BusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { SnapshotIdentity } from "@/lib/indicator-engine/snapshot/identity"

/**
 * Executive Brief 2.0 — presentation contract.
 *
 * Depends exclusively on prepared Business Snapshot + Business Digest.
 * Must never accept activity_events as input.
 *
 * Sprint 3: contracts only. No builder implementation.
 */

export type ExecutiveBriefMetric = {
  readonly id: string
  readonly label: string
  readonly value: number
}

export type ExecutiveBriefProductionBlock = {
  readonly id: string
  readonly title: string
  readonly metrics: readonly ExecutiveBriefMetric[]
}

export type ExecutiveBriefOperationalAlert = {
  readonly id: string
  readonly label: string
  readonly value: number
}

/**
 * Output shape for Executive Brief 2.0 (Sala / entity production consumers).
 */
export type ExecutiveBriefV2 = {
  readonly identity: SnapshotIdentity
  readonly date: string
  readonly narrative: string
  readonly generalState: readonly ExecutiveBriefMetric[]
  readonly production: readonly ExecutiveBriefProductionBlock[]
  readonly operationalAlerts: readonly ExecutiveBriefOperationalAlert[]
  /** From Business Digest — never raw Activity Engine scan. */
  readonly relevantActivity: BusinessDigest["items"]
  readonly snapshot: BusinessSnapshot
  readonly digest: BusinessDigest
  readonly firstEventAt: string | null
  readonly lastEventAt: string | null
  readonly activeTimeMs: number
}

/**
 * Sole public input for building Brief 2.0.
 * Explicitly excludes activity event arrays.
 */
export type BuildExecutiveBriefV2Input = {
  readonly snapshot: BusinessSnapshot
  readonly digest: BusinessDigest
}

/**
 * Builder port — implementation lands in a later sprint.
 */
export type ExecutiveBriefV2Builder = {
  build(input: BuildExecutiveBriefV2Input): ExecutiveBriefV2
}
