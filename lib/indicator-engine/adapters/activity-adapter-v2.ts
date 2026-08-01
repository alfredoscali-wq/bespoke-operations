import type { ActivityAdapter } from "@/lib/indicator-engine/adapters/activity-adapter"
import type { ActivityEngineSourceEventV2 } from "@/lib/indicator-engine/adapters/activity-source"
import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"

/**
 * Activity Adapter V2 — reserved for a future Activity Engine payload revision.
 * Structure only: not implemented in Sprint 6.
 */
export const activityAdapterV2: ActivityAdapter<ActivityEngineSourceEventV2> =
  {
    version: "v2",
    name: "ActivityAdapterV2",
    adaptOne() {
      return null
    },
    adapt(events) {
      if (events.length > 0 && process.env.NODE_ENV !== "production") {
        throw new Error(
          "ActivityAdapterV2 is not implemented yet (Sprint 6 placeholder)."
        )
      }
      const input: ActivityInput = { events: [] }
      return input
    },
  }
