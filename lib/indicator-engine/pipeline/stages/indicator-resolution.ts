import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import type { NormalizeOutput } from "@/lib/indicator-engine/pipeline/stages/normalize"
import type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

/**
 * Indicator Resolution — maps normalized facts to business indicator values.
 * Sprint 4: contract only. No calculation implementation.
 */
export type IndicatorResolutionInput = NormalizeOutput

export type IndicatorResolutionOutput = {
  /** Values keyed by business indicator id. */
  readonly values: Readonly<Record<string, IndicatorValue>>
}

export type IndicatorResolutionStage = PipelineStageContract<
  IndicatorResolutionInput,
  IndicatorResolutionOutput
>

export const indicatorResolutionStage: IndicatorResolutionStage = {
  id: "indicator_resolution",
  name: "Indicator Resolution",
  description:
    "Resolves registry indicators from normalized facts (calculation in a later sprint).",
}
