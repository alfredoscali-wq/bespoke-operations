/**
 * Performance Telemetry — development-only in-memory measurement (Sprint 11).
 * Production: disabled (no-op). Never logs, persists, or transmits.
 */

export type {
  PerformanceReport,
  PerformanceTelemetryCounters,
  TelemetrySource,
  TelemetryStage,
} from "@/lib/indicator-engine/telemetry/types"
export {
  TELEMETRY_SOURCES,
  TELEMETRY_STAGES,
} from "@/lib/indicator-engine/telemetry/types"

export { isPerformanceTelemetryEnabled } from "@/lib/indicator-engine/telemetry/enabled"

export {
  clearPerformanceReports,
  getLastPerformanceReport,
  getPerformanceTelemetrySummary,
  listPerformanceReports,
} from "@/lib/indicator-engine/telemetry/store"

export {
  measureTelemetryStage,
  performanceTelemetry,
  startPerformanceTelemetry,
  type PerformanceTelemetrySession,
} from "@/lib/indicator-engine/telemetry/performance-telemetry"

export {
  hookComparatorTelemetry,
  hookFacadeGetBrief,
  hookFacadeGetDigest,
  hookFacadeGetSnapshot,
  hookShadowPipelineTelemetry,
} from "@/lib/indicator-engine/telemetry/hooks"
