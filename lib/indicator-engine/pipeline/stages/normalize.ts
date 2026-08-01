import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

/**
 * Normalize — convert any activity origin into a common fact shape.
 * No indicator calculation. No business transformation beyond canonical fields.
 */
export type NormalizedActivityFact = {
  readonly id?: string
  /** Canonical module id after alias resolution (future). */
  readonly module: string
  readonly action: string
  readonly entityType: string
  readonly entityId: string | null
  readonly employeeId: string | null
  readonly createdAt: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly title: string | null
  readonly description: string | null
}

export type NormalizeInput = ActivityInput

export type NormalizeOutput = {
  readonly facts: readonly NormalizedActivityFact[]
}

export type NormalizeStage = PipelineStageContract<NormalizeInput, NormalizeOutput>

export const normalizeStage: NormalizeStage = {
  id: "normalize",
  name: "Normalize",
  description:
    "Canonicalises modules, actions, and nullability into NormalizedActivityFact[].",
}
