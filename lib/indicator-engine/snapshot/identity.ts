import type { BusinessDate } from "@/lib/indicator-engine/types"
import type { SnapshotScope } from "@/lib/indicator-engine/snapshot/scope"

/**
 * Unique identity of one official business snapshot.
 *
 * Conceptual key: company + business date + scope + subject + version.
 * No persistence in this sprint — identity contract only.
 */
export type SnapshotIdentity = {
  readonly companyId: string
  /** YYYY-MM-DD in the company timezone. */
  readonly date: BusinessDate
  readonly scope: SnapshotScope
  /**
   * Subject id for employee | crew | project | customer.
   * Must be null for company scope.
   */
  readonly subjectId: string | null
  /**
   * Identity / schema version for this snapshot key
   * (catalog or snapshot-model revision).
   */
  readonly version: string
}

/**
 * Optional display fields — never part of the identity key.
 */
export type SnapshotIdentityLabel = {
  readonly label?: string
}
