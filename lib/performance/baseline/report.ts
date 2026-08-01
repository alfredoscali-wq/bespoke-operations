/**
 * BaselineReport builder — compares screens and ranks by cost (Sprint 14).
 */

import {
  BASELINE_SCREEN_IDS,
  BASELINE_SCREEN_LABELS,
  type BaselineScreenId,
} from "@/lib/performance/baseline/screens"
import { listScreenMetrics } from "@/lib/performance/baseline/store"
import type {
  BaselineReport,
  ScreenMetrics,
} from "@/lib/performance/baseline/types"
import { isBaselineCollectorEnabled } from "@/lib/performance/baseline/enabled"

function emptyMetrics(screenId: BaselineScreenId, recordedAt: string): ScreenMetrics {
  return {
    screenId,
    label: BASELINE_SCREEN_LABELS[screenId],
    httpRequestCount: 0,
    supabaseQueryCount: 0,
    rpcCount: 0,
    totalLoadTimeMs: 0,
    renderTimeMs: 0,
    eventsProcessed: 0,
    estimatedPayloadBytes: 0,
    indicatorsCalculated: 0,
    executiveBriefsGenerated: 0,
    sampleCount: 0,
    recordedAt,
  }
}

function queryCount(m: ScreenMetrics): number {
  return m.supabaseQueryCount + m.rpcCount
}

function compareByLoadTime(a: ScreenMetrics, b: ScreenMetrics): number {
  if (b.totalLoadTimeMs !== a.totalLoadTimeMs) {
    return b.totalLoadTimeMs - a.totalLoadTimeMs
  }
  const q = queryCount(b) - queryCount(a)
  if (q !== 0) return q
  return b.estimatedPayloadBytes - a.estimatedPayloadBytes
}

function compareByQueryCount(a: ScreenMetrics, b: ScreenMetrics): number {
  const q = queryCount(b) - queryCount(a)
  if (q !== 0) return q
  if (b.totalLoadTimeMs !== a.totalLoadTimeMs) {
    return b.totalLoadTimeMs - a.totalLoadTimeMs
  }
  return b.estimatedPayloadBytes - a.estimatedPayloadBytes
}

function compareByPayload(a: ScreenMetrics, b: ScreenMetrics): number {
  if (b.estimatedPayloadBytes !== a.estimatedPayloadBytes) {
    return b.estimatedPayloadBytes - a.estimatedPayloadBytes
  }
  if (b.totalLoadTimeMs !== a.totalLoadTimeMs) {
    return b.totalLoadTimeMs - a.totalLoadTimeMs
  }
  return queryCount(b) - queryCount(a)
}

/**
 * Builds a BaselineReport from in-memory ScreenMetrics.
 * Includes all four scoped screens (zeros when not yet sampled).
 * Primary `screens` order: load time → queries → payload (desc).
 */
export function buildBaselineReport(
  now: string = new Date().toISOString()
): BaselineReport {
  const enabled = isBaselineCollectorEnabled()
  if (!enabled) {
    const empty = BASELINE_SCREEN_IDS.map((id) => emptyMetrics(id, now))
    return {
      generatedAt: now,
      screens: empty,
      ranking: {
        byLoadTime: empty.map((s) => s.screenId),
        byQueryCount: empty.map((s) => s.screenId),
        byPayloadSize: empty.map((s) => s.screenId),
      },
      enabled: false,
    }
  }

  const measured = new Map(
    listScreenMetrics().map((m) => [m.screenId, m] as const)
  )
  const screens: ScreenMetrics[] = BASELINE_SCREEN_IDS.map(
    (id) => measured.get(id) ?? emptyMetrics(id, now)
  )

  const byLoadTime = [...screens].sort(compareByLoadTime)
  const byQueryCount = [...screens].sort(compareByQueryCount)
  const byPayloadSize = [...screens].sort(compareByPayload)

  return {
    generatedAt: now,
    screens: byLoadTime,
    ranking: {
      byLoadTime: byLoadTime.map((s) => s.screenId),
      byQueryCount: byQueryCount.map((s) => s.screenId),
      byPayloadSize: byPayloadSize.map((s) => s.screenId),
    },
    enabled: true,
  }
}
