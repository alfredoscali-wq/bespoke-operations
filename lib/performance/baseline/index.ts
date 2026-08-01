/**
 * Executive-screen Baseline — consumption & performance (Sprint 14 / Bloque D).
 *
 * Uses Sprint 11 Performance Telemetry only. Dev-only. In-memory. No Supabase.
 */

export {
  BASELINE_SCREEN_IDS,
  BASELINE_SCREEN_LABELS,
  isBaselineScreenId,
  telemetrySourceToBaselineScreen,
  type BaselineScreenId,
} from "@/lib/performance/baseline/screens"

export type {
  BaselineRankingCriterion,
  BaselineReport,
  ScreenMetrics,
  ScreenMetricsInput,
} from "@/lib/performance/baseline/types"

export { isBaselineCollectorEnabled } from "@/lib/performance/baseline/enabled"

export { buildBaselineReport } from "@/lib/performance/baseline/report"

export {
  BaselineCollector,
  type BaselineCollectorApi,
  type BaselineScreenSession,
} from "@/lib/performance/baseline/baseline-collector"

export {
  clearScreenMetrics,
  getScreenMetrics,
  listScreenMetrics,
} from "@/lib/performance/baseline/store"
