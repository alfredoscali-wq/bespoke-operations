import { isPerformanceTelemetryEnabled } from "@/lib/indicator-engine/telemetry/enabled"
import { recordPerformanceReport } from "@/lib/indicator-engine/telemetry/store"
import type {
  PerformanceReport,
  PerformanceTelemetryCounters,
  TelemetrySource,
  TelemetryStage,
} from "@/lib/indicator-engine/telemetry/types"

let reportSeq = 0

function nextId(): string {
  reportSeq += 1
  return `perf-${Date.now()}-${reportSeq}`
}

export type PerformanceTelemetrySession = {
  readonly enabled: boolean
  markStage(stage: TelemetryStage, durationMs: number): void
  addEvents(count: number): void
  addIndicators(count: number): void
  recordSnapshotBuilt(count?: number): void
  recordDigestBuilt(count?: number): void
  recordBriefBuilt(count?: number): void
  setMetadata(key: string, value: unknown): void
  /**
   * Finalises the session into a PerformanceReport (dev only).
   * Returns null when telemetry is disabled.
   */
  finish(): PerformanceReport | null
}

const NOOP_SESSION: PerformanceTelemetrySession = {
  enabled: false,
  markStage() {},
  addEvents() {},
  addIndicators() {},
  recordSnapshotBuilt() {},
  recordDigestBuilt() {},
  recordBriefBuilt() {},
  setMetadata() {},
  finish() {
    return null
  },
}

/**
 * Starts an in-memory telemetry session.
 * In production returns a shared no-op session (zero allocation beyond the check).
 */
export function startPerformanceTelemetry(
  source: TelemetrySource
): PerformanceTelemetrySession {
  if (!isPerformanceTelemetryEnabled()) {
    return NOOP_SESSION
  }

  const startedAtMs = performance.now()
  const startedAt = new Date().toISOString()
  const stageDurationsMs: Record<string, number> = {}
  const counters: PerformanceTelemetryCounters = {
    eventCount: 0,
    indicatorCount: 0,
    snapshotsBuilt: 0,
    digestsBuilt: 0,
    briefsBuilt: 0,
  }
  const metadata: Record<string, unknown> = {}

  return {
    enabled: true,
    markStage(stage, durationMs) {
      const safe = Math.max(0, durationMs)
      stageDurationsMs[stage] = (stageDurationsMs[stage] ?? 0) + safe
    },
    addEvents(count) {
      counters.eventCount += Math.max(0, count)
    },
    addIndicators(count) {
      counters.indicatorCount += Math.max(0, count)
    },
    recordSnapshotBuilt(count = 1) {
      counters.snapshotsBuilt += Math.max(0, count)
    },
    recordDigestBuilt(count = 1) {
      counters.digestsBuilt += Math.max(0, count)
    },
    recordBriefBuilt(count = 1) {
      counters.briefsBuilt += Math.max(0, count)
    },
    setMetadata(key, value) {
      metadata[key] = value
    },
    finish() {
      const finishedAt = new Date().toISOString()
      const totalDurationMs = Math.max(0, performance.now() - startedAtMs)
      const report: PerformanceReport = {
        id: nextId(),
        source,
        startedAt,
        finishedAt,
        totalDurationMs,
        stageDurationsMs: { ...stageDurationsMs },
        eventCount: counters.eventCount,
        indicatorCount: counters.indicatorCount,
        snapshotsBuilt: counters.snapshotsBuilt,
        digestsBuilt: counters.digestsBuilt,
        briefsBuilt: counters.briefsBuilt,
        metadata: { ...metadata },
      }
      recordPerformanceReport(report)
      return report
    },
  }
}

/**
 * Measures a synchronous function as one telemetry stage (dev only).
 */
export function measureTelemetryStage<T>(
  session: PerformanceTelemetrySession,
  stage: TelemetryStage,
  fn: () => T
): T {
  if (!session.enabled) {
    return fn()
  }
  const started = performance.now()
  try {
    return fn()
  } finally {
    session.markStage(stage, performance.now() - started)
  }
}

export const performanceTelemetry = {
  start: startPerformanceTelemetry,
  measureStage: measureTelemetryStage,
  isEnabled: isPerformanceTelemetryEnabled,
} as const
