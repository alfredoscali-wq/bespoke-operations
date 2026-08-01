import type { ActivityEngineSourceEventV1 } from "@/lib/indicator-engine/adapters/activity-source"
import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { SnapshotScope } from "@/lib/indicator-engine/snapshot/scope"

/**
 * Event shape accepted by Shadow Pipeline.
 *
 * Compatible with Indicator Engine 1.x `IndicatorSourceEvent` and with
 * Activity Adapter V1 sources. Callers pass collections already in memory —
 * Shadow never queries Supabase.
 */
export type ShadowActivityEvent = ActivityEngineSourceEventV1

export type ShadowPipelineInput = {
  /** Already-loaded events (same collection IE 1.x would consume). */
  readonly events: readonly ShadowActivityEvent[]
  readonly context: PipelineContext
  readonly now?: string
}

/**
 * In-memory instrumentation only — never logged, never persisted.
 */
export type ShadowPipelineMetrics = {
  readonly ranAt: string
  readonly durationMs: number
  readonly eventCount: number
  readonly indicatorCount: number
  readonly scope: SnapshotScope
  readonly subjectId: string | null
  /** Always true — Shadow never exposes business artifacts. */
  readonly discarded: true
  readonly ok: boolean
  /** True when Feature Flags disabled the Shadow Pipeline. */
  readonly skipped?: boolean
  readonly errorMessage?: string
}

/**
 * Public outcome of a shadow run: metrics only.
 * Snapshot / Digest / Brief are intentionally absent.
 */
export type ShadowPipelineOutcome = {
  readonly metrics: ShadowPipelineMetrics
}
