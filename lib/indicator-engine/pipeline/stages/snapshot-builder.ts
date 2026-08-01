import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { IndicatorResolutionOutput } from "@/lib/indicator-engine/pipeline/stages/indicator-resolution"
import type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

/**
 * Snapshot Builder — builds a BusinessSnapshot from resolved indicators.
 * Does not persist or write anywhere. Contract only.
 */
export type SnapshotBuilderInput = IndicatorResolutionOutput

export type SnapshotBuilderOutput = {
  readonly snapshot: BusinessSnapshot
}

export type SnapshotBuilderStage = PipelineStageContract<
  SnapshotBuilderInput,
  SnapshotBuilderOutput
>

export const snapshotBuilderStage: SnapshotBuilderStage = {
  id: "snapshot_builder",
  name: "Snapshot Builder",
  description:
    "Assembles BusinessSnapshot identity + payload from resolved indicator values.",
}
