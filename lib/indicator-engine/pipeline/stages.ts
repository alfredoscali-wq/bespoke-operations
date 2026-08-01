import { activityInputStage } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import { normalizeStage } from "@/lib/indicator-engine/pipeline/stages/normalize"
import { indicatorResolutionStage } from "@/lib/indicator-engine/pipeline/stages/indicator-resolution"
import { snapshotBuilderStage } from "@/lib/indicator-engine/pipeline/stages/snapshot-builder"
import { digestBuilderStage } from "@/lib/indicator-engine/pipeline/stages/digest-builder"
import { briefBuilderStage } from "@/lib/indicator-engine/pipeline/stages/brief-builder"
import { outputStage } from "@/lib/indicator-engine/pipeline/stages/output"

/**
 * Official Indicator Engine 2.0 pipeline stages (sole allowed transformation path).
 *
 * Activity Input → Normalize → Indicator Resolution → Snapshot Builder →
 * Business Digest Builder → Executive Brief Builder → Output
 */
export const INDICATOR_PIPELINE_STAGES = [
  "activity_input",
  "normalize",
  "indicator_resolution",
  "snapshot_builder",
  "digest_builder",
  "brief_builder",
  "output",
] as const

export type IndicatorPipelineStage =
  (typeof INDICATOR_PIPELINE_STAGES)[number]

export type IndicatorPipelineDefinition = {
  readonly stages: readonly IndicatorPipelineStage[]
  readonly description: string
}

export const indicatorPipelineDefinition: IndicatorPipelineDefinition = {
  stages: INDICATOR_PIPELINE_STAGES,
  description:
    "Sole allowed path: Activity Input → Normalize → Indicator Resolution → Snapshot Builder → Business Digest Builder → Executive Brief Builder → Output. No shortcuts.",
}

export type PipelineStageDescriptor = {
  readonly id: IndicatorPipelineStage
  readonly name: string
  readonly responsibility: string
}

export const INDICATOR_PIPELINE_STAGE_DESCRIPTORS: readonly PipelineStageDescriptor[] =
  [
    {
      id: activityInputStage.id,
      name: activityInputStage.name,
      responsibility: activityInputStage.description,
    },
    {
      id: normalizeStage.id,
      name: normalizeStage.name,
      responsibility: normalizeStage.description,
    },
    {
      id: indicatorResolutionStage.id,
      name: indicatorResolutionStage.name,
      responsibility: indicatorResolutionStage.description,
    },
    {
      id: snapshotBuilderStage.id,
      name: snapshotBuilderStage.name,
      responsibility: snapshotBuilderStage.description,
    },
    {
      id: digestBuilderStage.id,
      name: digestBuilderStage.name,
      responsibility: digestBuilderStage.description,
    },
    {
      id: briefBuilderStage.id,
      name: briefBuilderStage.name,
      responsibility: briefBuilderStage.description,
    },
    {
      id: outputStage.id,
      name: outputStage.name,
      responsibility: outputStage.description,
    },
  ]

/** Ordered stage contracts — documentation / future runner wiring. */
export const INDICATOR_PIPELINE_STAGE_CONTRACTS = [
  activityInputStage,
  normalizeStage,
  indicatorResolutionStage,
  snapshotBuilderStage,
  digestBuilderStage,
  briefBuilderStage,
  outputStage,
] as const
