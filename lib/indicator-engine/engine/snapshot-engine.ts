import type { BusinessDigestItem } from "@/lib/indicator-engine/contracts/digest"
import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { SnapshotStatus } from "@/lib/indicator-engine/snapshot/status"
import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { PipelineResult } from "@/lib/indicator-engine/pipeline/result"
import { assertPipelineResultValidInDevelopment } from "@/lib/indicator-engine/pipeline/validate-pipeline"
import { createBrief } from "@/lib/indicator-engine/engine/brief-builder"
import { createDigest } from "@/lib/indicator-engine/engine/digest-builder"
import { createSnapshot } from "@/lib/indicator-engine/engine/snapshot-builder"

export type SnapshotEngineBuildInput = {
  readonly context: PipelineContext
  readonly indicators: Readonly<Record<string, IndicatorValue>>
  readonly status?: SnapshotStatus
  readonly digestItems?: readonly BusinessDigestItem[]
  readonly digestLimit?: number
  readonly now?: string
}

export type SnapshotEngineBuildOutput = {
  readonly snapshot: BusinessSnapshot
  readonly digest: ReturnType<typeof createDigest>
  readonly brief: ExecutiveBriefV2
  readonly result: PipelineResult
}

/**
 * In-memory Snapshot Engine — first functional Indicator Engine 2.0 component.
 *
 * Does not read Activity Events, calculate indicators, or touch Supabase.
 * Callers supply pre-resolved indicator values.
 */
export type SnapshotEngine = {
  createSnapshot: typeof createSnapshot
  createDigest: typeof createDigest
  createBrief: typeof createBrief
  build(input: SnapshotEngineBuildInput): SnapshotEngineBuildOutput
}

function build(input: SnapshotEngineBuildInput): SnapshotEngineBuildOutput {
  const snapshot = createSnapshot({
    context: input.context,
    indicators: input.indicators,
    status: input.status,
    now: input.now,
  })

  const digest = createDigest({
    snapshot,
    items: input.digestItems,
    limit: input.digestLimit,
    now: input.now,
  })

  const brief = createBrief({ snapshot, digest })

  const result: PipelineResult = {
    snapshot,
    digest,
    brief,
    warnings: [],
    errors: [],
    metadata: {
      engine: "snapshot-engine.in-memory",
      sprint: "platform-2.0-sprint-5",
    },
    context: input.context,
  }

  assertPipelineResultValidInDevelopment(result)

  return { snapshot, digest, brief, result }
}

export const snapshotEngine: SnapshotEngine = {
  createSnapshot,
  createDigest,
  createBrief,
  build,
}
