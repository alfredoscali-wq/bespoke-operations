import type { ShadowPipelineMetrics } from "@/lib/indicator-engine/shadow/types"

const MAX_RECENT_RUNS = 50

const recentRuns: ShadowPipelineMetrics[] = []
let lastRun: ShadowPipelineMetrics | null = null

/**
 * Record one shadow run in the in-memory ring buffer.
 * No logs, no Supabase, no Storage.
 */
export function recordShadowMetrics(metrics: ShadowPipelineMetrics): void {
  lastRun = metrics
  recentRuns.push(metrics)
  if (recentRuns.length > MAX_RECENT_RUNS) {
    recentRuns.splice(0, recentRuns.length - MAX_RECENT_RUNS)
  }
}

export function getLastShadowPipelineMetrics(): ShadowPipelineMetrics | null {
  return lastRun
}

export function listShadowPipelineMetrics(): readonly ShadowPipelineMetrics[] {
  return [...recentRuns]
}

export function clearShadowPipelineMetrics(): void {
  recentRuns.length = 0
  lastRun = null
}

export function getShadowPipelineMetricsSummary(): {
  readonly runCount: number
  readonly last: ShadowPipelineMetrics | null
  readonly totalEventsProcessed: number
  readonly totalDurationMs: number
} {
  let totalEventsProcessed = 0
  let totalDurationMs = 0
  for (const run of recentRuns) {
    totalEventsProcessed += run.eventCount
    totalDurationMs += run.durationMs
  }
  return {
    runCount: recentRuns.length,
    last: lastRun,
    totalEventsProcessed,
    totalDurationMs,
  }
}
