import type {
  ActivityAdapter,
  ActivityAdapterVersion,
} from "@/lib/indicator-engine/adapters/activity-adapter"
import { activityAdapterV1 } from "@/lib/indicator-engine/adapters/activity-adapter-v1"
import { activityAdapterV2 } from "@/lib/indicator-engine/adapters/activity-adapter-v2"

const REGISTRY: Record<ActivityAdapterVersion, ActivityAdapter> = {
  v1: activityAdapterV1 as ActivityAdapter,
  v2: activityAdapterV2 as ActivityAdapter,
}

/**
 * Resolve an Activity Adapter by protocol version.
 * Default: v1 (current Activity Engine shapes).
 */
export function getActivityAdapter(
  version: ActivityAdapterVersion = "v1"
): ActivityAdapter {
  const adapter = REGISTRY[version]
  if (!adapter) {
    throw new Error(`Unknown Activity Adapter version: "${version}".`)
  }
  return adapter
}

/** Default adapter for current Activity Engine → Activity Input. */
export const activityAdapter: ActivityAdapter = activityAdapterV1 as ActivityAdapter
