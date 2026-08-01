/**
 * Baseline enablement — reuses Sprint 11 Performance Telemetry gate.
 * Production: disabled → zero cost.
 */

import { isPerformanceTelemetryEnabled } from "@/lib/indicator-engine/telemetry/enabled"

export function isBaselineCollectorEnabled(): boolean {
  return isPerformanceTelemetryEnabled()
}
