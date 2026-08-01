import { isPerformanceTelemetryEnabled } from "@/lib/indicator-engine/telemetry/enabled"
import {
  measureTelemetryStage,
  startPerformanceTelemetry,
} from "@/lib/indicator-engine/telemetry/performance-telemetry"
import type { PerformanceReport } from "@/lib/indicator-engine/telemetry/types"
import type { ShadowPipelineMetrics } from "@/lib/indicator-engine/shadow/types"
import type { ComparisonReport } from "@/lib/indicator-engine/comparator/types"

/**
 * Hook: record Shadow Pipeline run into Performance Telemetry (dev only).
 */
export function hookShadowPipelineTelemetry(
  metrics: ShadowPipelineMetrics
): PerformanceReport | null {
  if (!isPerformanceTelemetryEnabled()) return null

  const session = startPerformanceTelemetry("shadow")
  session.addEvents(metrics.eventCount)
  session.addIndicators(metrics.indicatorCount)
  session.markStage("shadow_total", metrics.durationMs)
  if (metrics.ok) {
    session.recordSnapshotBuilt(1)
    session.recordDigestBuilt(1)
    session.recordBriefBuilt(1)
  }
  session.setMetadata("ok", metrics.ok)
  session.setMetadata("scope", metrics.scope)
  session.setMetadata("discarded", metrics.discarded)
  if (metrics.errorMessage) {
    session.setMetadata("errorMessage", metrics.errorMessage)
  }
  return session.finish()
}

/**
 * Hook: record Comparator run (dev only).
 */
export function hookComparatorTelemetry(
  report: ComparisonReport
): PerformanceReport | null {
  if (!isPerformanceTelemetryEnabled()) return null

  const session = startPerformanceTelemetry("comparator")
  session.markStage("comparator_total", report.comparisonTimeMs)
  session.recordSnapshotBuilt(1)
  session.recordDigestBuilt(1)
  session.recordBriefBuilt(1)
  session.setMetadata("match", report.match)
  session.setMetadata("coverageRatio", report.coverage.ratio)
  session.setMetadata("comparedFields", report.coverage.comparedFields)
  return session.finish()
}

/**
 * Hook helpers for Indicator Facade methods (dev only).
 */
export function hookFacadeGetSnapshot<
  T extends { readonly values: Readonly<Record<string, unknown>> },
>(eventCount: number, fn: () => T): T {
  if (!isPerformanceTelemetryEnabled()) {
    return fn()
  }
  const session = startPerformanceTelemetry("facade")
  session.addEvents(eventCount)
  const result = measureTelemetryStage(
    session,
    "facade_get_snapshot",
    fn
  )
  session.addIndicators(Object.keys(result.values).length)
  session.recordSnapshotBuilt(1)
  session.finish()
  return result
}

export function hookFacadeGetBrief<T>(
  eventCount: number,
  fn: () => T
): T {
  if (!isPerformanceTelemetryEnabled()) {
    return fn()
  }
  const session = startPerformanceTelemetry("facade")
  session.addEvents(eventCount)
  const result = measureTelemetryStage(session, "facade_get_brief", fn)
  session.recordSnapshotBuilt(1)
  session.recordDigestBuilt(1)
  session.recordBriefBuilt(1)
  session.finish()
  return result
}

export function hookFacadeGetDigest<T>(
  eventCount: number,
  fn: () => T
): T {
  if (!isPerformanceTelemetryEnabled()) {
    return fn()
  }
  const session = startPerformanceTelemetry("facade")
  session.addEvents(eventCount)
  const result = measureTelemetryStage(session, "facade_get_digest", fn)
  session.recordDigestBuilt(1)
  session.finish()
  return result
}
