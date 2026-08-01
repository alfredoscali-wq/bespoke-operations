/**
 * Telemetry enablement — controlled exclusively by Feature Flags (Sprint 13).
 */
import { isTelemetryEnabled } from "@/lib/indicator-engine/feature-flags"

export function isPerformanceTelemetryEnabled(): boolean {
  return isTelemetryEnabled()
}
