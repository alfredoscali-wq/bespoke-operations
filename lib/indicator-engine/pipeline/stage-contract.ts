import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { IndicatorPipelineStage } from "@/lib/indicator-engine/pipeline/stages"

/**
 * Generic stage contract: typed input → typed output, plus shared context.
 * Implementations land in later sprints. No business logic here.
 */
export type PipelineStageContract<TInput, TOutput> = {
  readonly id: IndicatorPipelineStage
  readonly name: string
  readonly description: string
  /**
   * Port for a future runner. Must not be invoked by product code yet.
   * Sprint 4 leaves this unimplemented on all stages.
   */
  readonly execute?: (
    input: TInput,
    context: PipelineContext
  ) => TOutput | Promise<TOutput>
}
