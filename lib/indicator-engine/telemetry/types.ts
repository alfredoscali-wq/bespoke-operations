/**
 * Performance telemetry types (Sprint 11).
 * In-memory only — never persisted or transmitted.
 */

export const TELEMETRY_SOURCES = [
  "shadow",
  "comparator",
  "facade",
  "pipeline",
  "manual",
  "dual_read",
] as const

export type TelemetrySource = (typeof TELEMETRY_SOURCES)[number]

export const TELEMETRY_STAGES = [
  "activity_input",
  "normalize",
  "indicator_resolution",
  "snapshot_builder",
  "digest_builder",
  "brief_builder",
  "output",
  "shadow_total",
  "comparator_total",
  "facade_get_snapshot",
  "facade_get_brief",
  "facade_get_digest",
  "dual_read_v1",
  "dual_read_v2",
] as const

export type TelemetryStage = (typeof TELEMETRY_STAGES)[number] | (string & {})

export type PerformanceReport = {
  readonly id: string
  readonly source: TelemetrySource
  readonly startedAt: string
  readonly finishedAt: string
  readonly totalDurationMs: number
  /** Duration per stage in milliseconds. */
  readonly stageDurationsMs: Readonly<Record<string, number>>
  readonly eventCount: number
  readonly indicatorCount: number
  readonly snapshotsBuilt: number
  readonly digestsBuilt: number
  readonly briefsBuilt: number
  readonly metadata: Readonly<Record<string, unknown>>
}

export type PerformanceTelemetryCounters = {
  eventCount: number
  indicatorCount: number
  snapshotsBuilt: number
  digestsBuilt: number
  briefsBuilt: number
}
