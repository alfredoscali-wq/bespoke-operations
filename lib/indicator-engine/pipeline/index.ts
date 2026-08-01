export type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
export type {
  PipelineIssue,
  PipelineResult,
} from "@/lib/indicator-engine/pipeline/result"
export type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

export {
  getIndicatorPipelineStageDescriptor,
  indicatorPipeline,
  listIndicatorPipelineStages,
  type IndicatorPipeline,
  type IndicatorPipelineRunner,
} from "@/lib/indicator-engine/pipeline/pipeline"

export {
  inMemoryPipelineRunner,
  runInMemoryPipeline,
  type InMemoryPipelineRunInput,
  type InMemoryPipelineRunOutput,
} from "@/lib/indicator-engine/pipeline/in-memory-runner"

export {
  INDICATOR_PIPELINE_STAGE_CONTRACTS,
  INDICATOR_PIPELINE_STAGE_DESCRIPTORS,
  INDICATOR_PIPELINE_STAGES,
  indicatorPipelineDefinition,
  type IndicatorPipelineDefinition,
  type IndicatorPipelineStage,
  type PipelineStageDescriptor,
} from "@/lib/indicator-engine/pipeline/stages"

export type {
  ActivityInput,
  ActivityInputEvent,
  ActivityInputStage,
} from "@/lib/indicator-engine/pipeline/stages/activity-input"
export { activityInputStage } from "@/lib/indicator-engine/pipeline/stages/activity-input"

export type {
  NormalizeInput,
  NormalizeOutput,
  NormalizeStage,
  NormalizedActivityFact,
} from "@/lib/indicator-engine/pipeline/stages/normalize"
export { normalizeStage } from "@/lib/indicator-engine/pipeline/stages/normalize"

export type {
  IndicatorResolutionInput,
  IndicatorResolutionOutput,
  IndicatorResolutionStage,
} from "@/lib/indicator-engine/pipeline/stages/indicator-resolution"
export { indicatorResolutionStage } from "@/lib/indicator-engine/pipeline/stages/indicator-resolution"

export type {
  SnapshotBuilderInput,
  SnapshotBuilderOutput,
  SnapshotBuilderStage,
} from "@/lib/indicator-engine/pipeline/stages/snapshot-builder"
export { snapshotBuilderStage } from "@/lib/indicator-engine/pipeline/stages/snapshot-builder"

export type {
  DigestBuilderInput,
  DigestBuilderOutput,
  DigestBuilderStage,
} from "@/lib/indicator-engine/pipeline/stages/digest-builder"
export { digestBuilderStage } from "@/lib/indicator-engine/pipeline/stages/digest-builder"

export type {
  BriefBuilderInput,
  BriefBuilderOutput,
  BriefBuilderStage,
} from "@/lib/indicator-engine/pipeline/stages/brief-builder"
export { briefBuilderStage } from "@/lib/indicator-engine/pipeline/stages/brief-builder"

export type {
  OutputStage,
  PipelineOutput,
  PipelineOutputInput,
} from "@/lib/indicator-engine/pipeline/stages/output"
export { outputStage } from "@/lib/indicator-engine/pipeline/stages/output"

export {
  assertActivityInputValidInDevelopment,
  assertPipelineContextValidInDevelopment,
  assertPipelineResultValidInDevelopment,
  isIndicatorPipelineStage,
  validateActivityInput,
  validatePipelineContext,
  validatePipelineResult,
} from "@/lib/indicator-engine/pipeline/validate-pipeline"
