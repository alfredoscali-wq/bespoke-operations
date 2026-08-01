import type { SnapshotScope } from "@/lib/indicator-engine/snapshot/scope"
import type { BusinessDate } from "@/lib/indicator-engine/types"

/**
 * Shared context carried through every Indicator Engine 2.0 pipeline stage.
 * Stages must not couple to each other — they only read this bag + their typed input.
 *
 * Sprint 4: contract only.
 */
export type PipelineContext = {
  readonly companyId: string
  /** Business calendar date (YYYY-MM-DD, company timezone). */
  readonly date: BusinessDate
  readonly scope: SnapshotScope
  /**
   * Subject id for employee | crew | project | customer.
   * Null for company scope.
   */
  readonly subjectId: string | null
  /** Snapshot / pipeline identity version. */
  readonly version: string
  /** Registry catalog version the pipeline should honour. */
  readonly catalogVersion: string
  /** Opaque extension bag — no stage-to-stage typed coupling. */
  readonly metadata: Readonly<Record<string, unknown>>
  /** Company timezone (IANA), when known. */
  readonly timeZone?: string
}
