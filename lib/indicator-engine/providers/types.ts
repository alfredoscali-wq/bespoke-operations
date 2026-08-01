import type { ActivityEngineSourceEventV1 } from "@/lib/indicator-engine/adapters/activity-source"

/**
 * Activity Provider — supplies opaque source events for the adapter.
 * Implementations must not import Activity Engine or query Supabase.
 */
export type ActivityProvider = {
  readonly name: string
  listEvents(): readonly ActivityEngineSourceEventV1[]
}
