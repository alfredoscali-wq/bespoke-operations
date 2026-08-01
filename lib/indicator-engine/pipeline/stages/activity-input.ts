import type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

/**
 * Activity Input — business facts for Indicator Engine 2.0.
 *
 * Produced only by Activity Adapter. Must not carry Activity Engine technical
 * fields (severity, origin, actor, geo, session, RPC payloads, …).
 */
export type ActivityInputEvent = {
  readonly id: string | null
  /** Canonical business module (aliases resolved by adapter). */
  readonly module: string
  readonly action: string
  readonly entityType: string | null
  readonly entityId: string | null
  readonly employeeId: string | null
  readonly createdAt: string
  /** Allowlisted business metadata only (string values). */
  readonly metadata: Readonly<Record<string, string>>
  readonly title: string | null
  readonly description: string | null
}

export type ActivityInput = {
  readonly events: readonly ActivityInputEvent[]
}

export type ActivityInputStage = PipelineStageContract<ActivityInput, ActivityInput>

export const activityInputStage: ActivityInputStage = {
  id: "activity_input",
  name: "Activity Input",
  description:
    "Accepts adapter-produced business facts as the sole upstream input to the pipeline.",
}
