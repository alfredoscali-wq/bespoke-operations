import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import type { ActivityInputEvent } from "@/lib/indicator-engine/pipeline/stages/activity-input"

/**
 * Supported Activity Adapter protocol versions.
 * Add new versions here without changing Indicator Engine consumers.
 */
export const ACTIVITY_ADAPTER_VERSIONS = ["v1", "v2"] as const

export type ActivityAdapterVersion =
  (typeof ACTIVITY_ADAPTER_VERSIONS)[number]

/**
 * Sole authorized boundary between Activity Engine payloads and Indicator Engine 2.0.
 */
export type ActivityAdapter<TSource = unknown> = {
  readonly version: ActivityAdapterVersion
  readonly name: string
  /**
   * Transform source events into Activity Input.
   * Invalid / incomplete events are skipped (not thrown).
   */
  adapt(events: readonly TSource[]): ActivityInput
  /**
   * Adapt a single event. Returns null when the event cannot be mapped.
   */
  adaptOne(event: TSource): ActivityInputEvent | null
}
