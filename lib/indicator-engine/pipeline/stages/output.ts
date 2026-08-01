import type { PipelineResult } from "@/lib/indicator-engine/pipeline/result"
import type { BriefBuilderOutput } from "@/lib/indicator-engine/pipeline/stages/brief-builder"
import type { DigestBuilderOutput } from "@/lib/indicator-engine/pipeline/stages/digest-builder"
import type { SnapshotBuilderOutput } from "@/lib/indicator-engine/pipeline/stages/snapshot-builder"
import type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

/**
 * Output — packages Snapshot, Digest, Brief into the official PipelineResult.
 * Contract only; no I/O.
 */
export type PipelineOutputInput = SnapshotBuilderOutput &
  DigestBuilderOutput &
  BriefBuilderOutput

export type PipelineOutput = PipelineResult

export type OutputStage = PipelineStageContract<PipelineOutputInput, PipelineOutput>

export const outputStage: OutputStage = {
  id: "output",
  name: "Output",
  description:
    "Emits the official PipelineResult for downstream UI consumers.",
}
