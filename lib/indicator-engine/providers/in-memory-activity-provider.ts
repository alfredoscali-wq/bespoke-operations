import type { ActivityEngineSourceEventV1 } from "@/lib/indicator-engine/adapters/activity-source"
import type { ActivityProvider } from "@/lib/indicator-engine/providers/types"
import { DEMO_ACTIVITY_DATASET } from "@/lib/indicator-engine/providers/mock-dataset"

/**
 * In-memory Activity Provider — simulated events only.
 * Does not import Activity Engine or read activity_events.
 */
export function createInMemoryActivityProvider(
  events: readonly ActivityEngineSourceEventV1[] = DEMO_ACTIVITY_DATASET,
  name = "InMemoryActivityProvider"
): ActivityProvider {
  const frozen = Object.freeze([...events]) as readonly ActivityEngineSourceEventV1[]
  return {
    name,
    listEvents() {
      return frozen
    },
  }
}

/** Default demo provider used by E2E tests. */
export const inMemoryActivityProvider: ActivityProvider =
  createInMemoryActivityProvider()

export const emptyInMemoryActivityProvider: ActivityProvider =
  createInMemoryActivityProvider([], "InMemoryActivityProvider.empty")
