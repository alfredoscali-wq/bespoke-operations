import { isShadowPipelineEnabled } from "@/lib/indicator-engine/feature-flags"
import { createInMemoryActivityProvider } from "@/lib/indicator-engine/providers/in-memory-activity-provider"
import { runInMemoryPipeline } from "@/lib/indicator-engine/pipeline/in-memory-runner"
import { recordShadowMetrics } from "@/lib/indicator-engine/shadow/metrics-store"
import { hookShadowPipelineTelemetry } from "@/lib/indicator-engine/telemetry/hooks"
import type {
  ShadowPipelineInput,
  ShadowPipelineMetrics,
  ShadowPipelineOutcome,
} from "@/lib/indicator-engine/shadow/types"

function nowIso(override?: string): string {
  return override ?? new Date().toISOString()
}

function buildFailureMetrics(
  input: ShadowPipelineInput,
  durationMs: number,
  errorMessage: string
): ShadowPipelineMetrics {
  return {
    ranAt: nowIso(input.now),
    durationMs,
    eventCount: input.events.length,
    indicatorCount: 0,
    scope: input.context.scope,
    subjectId: input.context.subjectId,
    discarded: true,
    ok: false,
    errorMessage,
  }
}

/**
 * Shadow Pipeline — runs Indicator Engine 2.0 in parallel on in-memory events.
 *
 * Produces Snapshot + Digest + Brief V2 internally, then discards them.
 * Returns instrumentation metrics only. Never persists. Never queries Supabase.
 *
 * Execution is gated exclusively by Feature Flags (Sprint 13).
 */
export function runShadowPipeline(
  input: ShadowPipelineInput
): ShadowPipelineOutcome {
  if (!isShadowPipelineEnabled()) {
    const metrics: ShadowPipelineMetrics = {
      ranAt: nowIso(input.now),
      durationMs: 0,
      eventCount: input.events.length,
      indicatorCount: 0,
      scope: input.context.scope,
      subjectId: input.context.subjectId,
      discarded: true,
      ok: true,
      skipped: true,
    }
    recordShadowMetrics(metrics)
    return { metrics }
  }

  const started = performance.now()

  try {
    const provider = createInMemoryActivityProvider(
      input.events,
      "ShadowPipeline.provider"
    )

    const { result } = runInMemoryPipeline({
      context: input.context,
      provider,
      now: input.now,
    })

    const indicatorCount = result.snapshot
      ? Object.keys(result.snapshot.payload.indicators).length
      : 0

    // Explicit discard — business artifacts must not escape this function.
    void result.snapshot
    void result.digest
    void result.brief

    const metrics: ShadowPipelineMetrics = {
      ranAt: nowIso(input.now),
      durationMs: Math.max(0, performance.now() - started),
      eventCount: input.events.length,
      indicatorCount,
      scope: input.context.scope,
      subjectId: input.context.subjectId,
      discarded: true,
      ok: true,
    }

    recordShadowMetrics(metrics)
    hookShadowPipelineTelemetry(metrics)
    return { metrics }
  } catch (error) {
    const metrics = buildFailureMetrics(
      input,
      Math.max(0, performance.now() - started),
      error instanceof Error ? error.message : String(error)
    )
    recordShadowMetrics(metrics)
    hookShadowPipelineTelemetry(metrics)
    return { metrics }
  }
}

/**
 * Fire-and-forget shadow observation.
 * Never throws — safe to call beside IE 1.x without affecting the host path.
 */
export function observeShadowPipeline(input: ShadowPipelineInput): void {
  try {
    runShadowPipeline(input)
  } catch {
    // Shadow must never affect the host path.
  }
}

export const shadowPipeline = {
  run: runShadowPipeline,
  observe: observeShadowPipeline,
} as const
