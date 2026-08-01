/**
 * Baseline consumption / performance contracts (Sprint 14).
 * In-memory only — never persisted or transmitted.
 */

import type { BaselineScreenId } from "@/lib/performance/baseline/screens"

/**
 * Per-screen consumption and performance metrics.
 */
export type ScreenMetrics = {
  readonly screenId: BaselineScreenId
  readonly label: string
  /** HTTP requests attributed to this screen load. */
  readonly httpRequestCount: number
  /** Supabase client queries (select/insert/…), excluding RPC. */
  readonly supabaseQueryCount: number
  /** Supabase RPC calls. */
  readonly rpcCount: number
  /** End-to-end load time in milliseconds. */
  readonly totalLoadTimeMs: number
  /** Client/render portion in milliseconds (when known). */
  readonly renderTimeMs: number
  /** Activity / indicator source events processed. */
  readonly eventsProcessed: number
  /** Estimated downloaded payload size in bytes. */
  readonly estimatedPayloadBytes: number
  /** Indicators calculated during the load. */
  readonly indicatorsCalculated: number
  /** Executive Brief instances generated. */
  readonly executiveBriefsGenerated: number
  /** How many samples were folded into these averages/totals. */
  readonly sampleCount: number
  readonly recordedAt: string
}

export type BaselineRankingCriterion =
  | "totalLoadTimeMs"
  | "queryCount"
  | "estimatedPayloadBytes"

export type BaselineReport = {
  readonly generatedAt: string
  /** All measured screens, sorted by optimization priority. */
  readonly screens: readonly ScreenMetrics[]
  /**
   * Explicit ranking lists (same order as `screens` for the primary sort,
   * plus dedicated lists for secondary criteria).
   */
  readonly ranking: {
    readonly byLoadTime: readonly BaselineScreenId[]
    readonly byQueryCount: readonly BaselineScreenId[]
    readonly byPayloadSize: readonly BaselineScreenId[]
  }
  readonly enabled: boolean
}

export type ScreenMetricsInput = {
  readonly screenId: BaselineScreenId
  readonly httpRequestCount?: number
  readonly supabaseQueryCount?: number
  readonly rpcCount?: number
  readonly totalLoadTimeMs?: number
  readonly renderTimeMs?: number
  readonly eventsProcessed?: number
  readonly estimatedPayloadBytes?: number
  readonly indicatorsCalculated?: number
  readonly executiveBriefsGenerated?: number
  readonly recordedAt?: string
}
