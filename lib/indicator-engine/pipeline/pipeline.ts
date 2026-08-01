import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { PipelineResult } from "@/lib/indicator-engine/pipeline/result"
import {
  INDICATOR_PIPELINE_STAGE_CONTRACTS,
  INDICATOR_PIPELINE_STAGE_DESCRIPTORS,
  INDICATOR_PIPELINE_STAGES,
  indicatorPipelineDefinition,
  type IndicatorPipelineDefinition,
  type IndicatorPipelineStage,
} from "@/lib/indicator-engine/pipeline/stages"

/**
 * Official Indicator Pipeline 2.0 — sole allowed transformation path.
 *
 * Sprint 4: definition + ports only. No runner execution, no I/O, no calculations.
 */
export type IndicatorPipeline = {
  readonly definition: IndicatorPipelineDefinition
  readonly stages: typeof INDICATOR_PIPELINE_STAGE_CONTRACTS
}

/**
 * Future runner port. Product code must not call this until a later sprint
 * implements it. Intentionally has no default implementation.
 */
export type IndicatorPipelineRunner = {
  run(
    input: ActivityInput,
    context: PipelineContext
  ): Promise<PipelineResult>
}

export const indicatorPipeline: IndicatorPipeline = {
  definition: indicatorPipelineDefinition,
  stages: INDICATOR_PIPELINE_STAGE_CONTRACTS,
}

export function listIndicatorPipelineStages(): readonly IndicatorPipelineStage[] {
  return INDICATOR_PIPELINE_STAGES
}

export function getIndicatorPipelineStageDescriptor(
  id: IndicatorPipelineStage
) {
  return INDICATOR_PIPELINE_STAGE_DESCRIPTORS.find((stage) => stage.id === id)
}
