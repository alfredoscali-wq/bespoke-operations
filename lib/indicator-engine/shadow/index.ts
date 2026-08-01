/**
 * Shadow Pipeline — Indicator Engine 2.0 parallel processing (Sprint 8).
 *
 * Runs on in-memory event collections already loaded by the host.
 * Discards Snapshot / Digest / Brief. Keeps metrics in memory only.
 *
 * No product call sites in Sprint 8 (screens / APIs / IE 1.x unchanged).
 * Hook point for later sprints: `observeShadowPipeline`.
 */

export type {
  ShadowActivityEvent,
  ShadowPipelineInput,
  ShadowPipelineMetrics,
  ShadowPipelineOutcome,
} from "@/lib/indicator-engine/shadow/types"

export {
  clearShadowPipelineMetrics,
  getLastShadowPipelineMetrics,
  getShadowPipelineMetricsSummary,
  listShadowPipelineMetrics,
} from "@/lib/indicator-engine/shadow/metrics-store"

export {
  observeShadowPipeline,
  runShadowPipeline,
  shadowPipeline,
} from "@/lib/indicator-engine/shadow/shadow-pipeline"
