/**
 * BaselineCollector — measures executive-screen consumption via Sprint 11 Telemetry.
 *
 * Does not query Supabase, log, or persist. Production: no-op (zero cost).
 * Does not modify screens / APIs / Indicator Engine behaviour.
 */

import {
  listPerformanceReports,
  type PerformanceReport,
} from "@/lib/indicator-engine/telemetry"
import { startPerformanceTelemetry } from "@/lib/indicator-engine/telemetry/performance-telemetry"
import { isBaselineCollectorEnabled } from "@/lib/performance/baseline/enabled"
import { buildBaselineReport } from "@/lib/performance/baseline/report"
import {
  BASELINE_SCREEN_LABELS,
  telemetrySourceToBaselineScreen,
  type BaselineScreenId,
} from "@/lib/performance/baseline/screens"
import {
  clearScreenMetrics,
  getScreenMetrics,
  listScreenMetrics,
  upsertScreenMetrics,
} from "@/lib/performance/baseline/store"
import type {
  BaselineReport,
  ScreenMetrics,
  ScreenMetricsInput,
} from "@/lib/performance/baseline/types"

function nonNeg(n: number | undefined, fallback = 0): number {
  if (n == null || !Number.isFinite(n)) return fallback
  return Math.max(0, n)
}

function mergeMetrics(
  previous: ScreenMetrics | null,
  sample: ScreenMetrics
): ScreenMetrics {
  if (!previous || previous.sampleCount <= 0) {
    return { ...sample, sampleCount: Math.max(1, sample.sampleCount) }
  }

  const n0 = previous.sampleCount
  const n1 = Math.max(1, sample.sampleCount)
  const total = n0 + n1
  const avg = (a: number, b: number) => (a * n0 + b * n1) / total

  return {
    screenId: sample.screenId,
    label: sample.label,
    httpRequestCount: avg(previous.httpRequestCount, sample.httpRequestCount),
    supabaseQueryCount: avg(
      previous.supabaseQueryCount,
      sample.supabaseQueryCount
    ),
    rpcCount: avg(previous.rpcCount, sample.rpcCount),
    totalLoadTimeMs: avg(previous.totalLoadTimeMs, sample.totalLoadTimeMs),
    renderTimeMs: avg(previous.renderTimeMs, sample.renderTimeMs),
    eventsProcessed: avg(previous.eventsProcessed, sample.eventsProcessed),
    estimatedPayloadBytes: avg(
      previous.estimatedPayloadBytes,
      sample.estimatedPayloadBytes
    ),
    indicatorsCalculated: avg(
      previous.indicatorsCalculated,
      sample.indicatorsCalculated
    ),
    executiveBriefsGenerated: avg(
      previous.executiveBriefsGenerated,
      sample.executiveBriefsGenerated
    ),
    sampleCount: total,
    recordedAt: sample.recordedAt,
  }
}

function toScreenMetrics(input: ScreenMetricsInput): ScreenMetrics {
  return {
    screenId: input.screenId,
    label: BASELINE_SCREEN_LABELS[input.screenId],
    httpRequestCount: nonNeg(input.httpRequestCount),
    supabaseQueryCount: nonNeg(input.supabaseQueryCount),
    rpcCount: nonNeg(input.rpcCount),
    totalLoadTimeMs: nonNeg(input.totalLoadTimeMs),
    renderTimeMs: nonNeg(input.renderTimeMs),
    eventsProcessed: nonNeg(input.eventsProcessed),
    estimatedPayloadBytes: nonNeg(input.estimatedPayloadBytes),
    indicatorsCalculated: nonNeg(input.indicatorsCalculated),
    executiveBriefsGenerated: nonNeg(input.executiveBriefsGenerated),
    sampleCount: 1,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  }
}

export type BaselineScreenSession = {
  readonly enabled: boolean
  readonly screenId: BaselineScreenId
  recordHttpRequest(count?: number): void
  recordSupabaseQuery(count?: number): void
  recordRpc(count?: number): void
  recordRenderTime(ms: number): void
  recordEvents(count: number): void
  recordPayloadBytes(bytes: number): void
  recordIndicators(count: number): void
  recordExecutiveBrief(count?: number): void
  /**
   * Finalises the session into ScreenMetrics (dev only).
   * Also records a Sprint 11 telemetry "manual" report tagged with the screen.
   */
  finish(): ScreenMetrics | null
}

const NOOP_SESSION: BaselineScreenSession = {
  enabled: false,
  screenId: "sala_situacion",
  recordHttpRequest() {},
  recordSupabaseQuery() {},
  recordRpc() {},
  recordRenderTime() {},
  recordEvents() {},
  recordPayloadBytes() {},
  recordIndicators() {},
  recordExecutiveBrief() {},
  finish() {
    return null
  },
}

function createSession(screenId: BaselineScreenId): BaselineScreenSession {
  if (!isBaselineCollectorEnabled()) {
    return { ...NOOP_SESSION, screenId }
  }

  const startedAtMs = performance.now()
  const telemetry = startPerformanceTelemetry("manual")
  telemetry.setMetadata("baselineScreenId", screenId)
  telemetry.setMetadata("baselineLabel", BASELINE_SCREEN_LABELS[screenId])

  let httpRequestCount = 0
  let supabaseQueryCount = 0
  let rpcCount = 0
  let renderTimeMs = 0
  let eventsProcessed = 0
  let estimatedPayloadBytes = 0
  let indicatorsCalculated = 0
  let executiveBriefsGenerated = 0
  let finished = false

  return {
    enabled: true,
    screenId,
    recordHttpRequest(count = 1) {
      httpRequestCount += nonNeg(count)
    },
    recordSupabaseQuery(count = 1) {
      supabaseQueryCount += nonNeg(count)
    },
    recordRpc(count = 1) {
      rpcCount += nonNeg(count)
    },
    recordRenderTime(ms) {
      renderTimeMs += nonNeg(ms)
    },
    recordEvents(count) {
      const n = nonNeg(count)
      eventsProcessed += n
      telemetry.addEvents(n)
    },
    recordPayloadBytes(bytes) {
      estimatedPayloadBytes += nonNeg(bytes)
    },
    recordIndicators(count) {
      const n = nonNeg(count)
      indicatorsCalculated += n
      telemetry.addIndicators(n)
    },
    recordExecutiveBrief(count = 1) {
      const n = nonNeg(count)
      executiveBriefsGenerated += n
      telemetry.recordBriefBuilt(n)
    },
    finish() {
      if (finished) return getScreenMetrics(screenId)
      finished = true

      const totalLoadTimeMs = Math.max(0, performance.now() - startedAtMs)
      telemetry.markStage("baseline_screen_load", totalLoadTimeMs)
      if (renderTimeMs > 0) {
        telemetry.markStage("baseline_render", renderTimeMs)
      }
      telemetry.setMetadata("httpRequestCount", httpRequestCount)
      telemetry.setMetadata("supabaseQueryCount", supabaseQueryCount)
      telemetry.setMetadata("rpcCount", rpcCount)
      telemetry.setMetadata("estimatedPayloadBytes", estimatedPayloadBytes)
      telemetry.setMetadata("renderTimeMs", renderTimeMs)
      telemetry.finish()

      const sample = toScreenMetrics({
        screenId,
        httpRequestCount,
        supabaseQueryCount,
        rpcCount,
        totalLoadTimeMs,
        renderTimeMs,
        eventsProcessed,
        estimatedPayloadBytes,
        indicatorsCalculated,
        executiveBriefsGenerated,
      })

      const merged = mergeMetrics(getScreenMetrics(screenId), sample)
      upsertScreenMetrics(merged)
      return merged
    },
  }
}

function metricsFromTelemetryReport(
  report: PerformanceReport
): ScreenMetrics | null {
  const screenId =
    (typeof report.metadata.baselineScreenId === "string"
      ? (report.metadata.baselineScreenId as BaselineScreenId)
      : null) ?? telemetrySourceToBaselineScreen(report.source)

  if (!screenId) return null

  const metaNum = (key: string): number => {
    const v = report.metadata[key]
    return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0
  }

  return toScreenMetrics({
    screenId,
    httpRequestCount: metaNum("httpRequestCount"),
    supabaseQueryCount: metaNum("supabaseQueryCount"),
    rpcCount: metaNum("rpcCount"),
    totalLoadTimeMs: report.totalDurationMs,
    renderTimeMs: metaNum("renderTimeMs"),
    eventsProcessed: report.eventCount,
    estimatedPayloadBytes: metaNum("estimatedPayloadBytes"),
    indicatorsCalculated: report.indicatorCount,
    executiveBriefsGenerated: report.briefsBuilt,
    recordedAt: report.finishedAt,
  })
}

/**
 * Official Baseline Collector (Sprint 14).
 */
export const BaselineCollector = {
  isEnabled: isBaselineCollectorEnabled,

  /** Starts a screen measurement session (dev only). */
  startScreen(screenId: BaselineScreenId): BaselineScreenSession {
    return createSession(screenId)
  },

  /** Records (or merges) an explicit sample without a timed session. */
  record(input: ScreenMetricsInput): ScreenMetrics | null {
    if (!isBaselineCollectorEnabled()) return null
    const sample = toScreenMetrics(input)
    const merged = mergeMetrics(getScreenMetrics(input.screenId), sample)
    upsertScreenMetrics(merged)
    return merged
  },

  /**
   * Ingests Sprint 11 PerformanceReports into baseline ScreenMetrics.
   * Maps `dual_read` / `facade` → Sala; respects `baselineScreenId` metadata.
   */
  ingestFromTelemetry(
    reports: readonly PerformanceReport[] = listPerformanceReports()
  ): number {
    if (!isBaselineCollectorEnabled()) return 0
    let ingested = 0
    for (const report of reports) {
      const sample = metricsFromTelemetryReport(report)
      if (!sample) continue
      const merged = mergeMetrics(getScreenMetrics(sample.screenId), sample)
      upsertScreenMetrics(merged)
      ingested += 1
    }
    return ingested
  },

  get(screenId: BaselineScreenId): ScreenMetrics | null {
    return getScreenMetrics(screenId)
  },

  list(): readonly ScreenMetrics[] {
    return listScreenMetrics()
  },

  buildReport(): BaselineReport {
    return buildBaselineReport()
  },

  clear(): void {
    clearScreenMetrics()
  },
} as const

export type BaselineCollectorApi = typeof BaselineCollector
