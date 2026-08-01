import type { ActivityAdapter } from "@/lib/indicator-engine/adapters/activity-adapter"
import type { ActivityEngineSourceEventV1 } from "@/lib/indicator-engine/adapters/activity-source"
import { mapActivityEngineEventV1ToInput } from "@/lib/indicator-engine/adapters/mapping/map-activity-event-v1"
import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import { assertActivityInputValidInDevelopment } from "@/lib/indicator-engine/pipeline/validate-pipeline"

/**
 * Activity Adapter V1 — current Activity Engine event shapes → Activity Input.
 */
export const activityAdapterV1: ActivityAdapter<ActivityEngineSourceEventV1> =
  {
    version: "v1",
    name: "ActivityAdapterV1",
    adaptOne(event) {
      if (event == null || typeof event !== "object") return null
      return mapActivityEngineEventV1ToInput(event)
    },
    adapt(events) {
      const mapped = events
        .map((event) => activityAdapterV1.adaptOne(event))
        .filter((event): event is NonNullable<typeof event> => event != null)

      const input: ActivityInput = { events: mapped }
      assertActivityInputValidInDevelopment(input)
      return input
    },
  }
