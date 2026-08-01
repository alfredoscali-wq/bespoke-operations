import type { BusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { IndicatorPipelineStage } from "@/lib/indicator-engine/pipeline/stages"

/**
 * Non-fatal or fatal pipeline diagnostics (contract only).
 */
export type PipelineIssue = {
  readonly code: string
  readonly message: string
  readonly stage?: IndicatorPipelineStage
}

/**
 * Official result of the Indicator Engine 2.0 pipeline.
 * No execution in Sprint 4 — shape only.
 */
export type PipelineResult = {
  readonly snapshot: BusinessSnapshot | null
  readonly digest: BusinessDigest | null
  readonly brief: ExecutiveBriefV2 | null
  readonly warnings: readonly PipelineIssue[]
  readonly errors: readonly PipelineIssue[]
  readonly metadata: Readonly<Record<string, unknown>>
  readonly context: PipelineContext
}
