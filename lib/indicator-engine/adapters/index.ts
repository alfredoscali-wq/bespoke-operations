/**
 * Activity Adapter boundary — sole authorized bridge from Activity Engine
 * shaped payloads into Indicator Engine 2.0 Activity Input.
 *
 * The rest of Indicator Engine 2.0 must never import `@/lib/activity`.
 */

export type {
  ActivityAdapter,
  ActivityAdapterVersion,
} from "@/lib/indicator-engine/adapters/activity-adapter"
export { ACTIVITY_ADAPTER_VERSIONS } from "@/lib/indicator-engine/adapters/activity-adapter"

export type {
  ActivityEngineSourceEventV1,
  ActivityEngineSourceEventV2,
} from "@/lib/indicator-engine/adapters/activity-source"

export { activityAdapterV1 } from "@/lib/indicator-engine/adapters/activity-adapter-v1"
export { activityAdapterV2 } from "@/lib/indicator-engine/adapters/activity-adapter-v2"

export {
  activityAdapter,
  getActivityAdapter,
} from "@/lib/indicator-engine/adapters/registry"

export {
  ADAPTER_MODULE_ALIASES,
  canonicalizeAdapterModule,
} from "@/lib/indicator-engine/adapters/mapping/module-aliases"
export {
  ACTIVITY_INPUT_METADATA_ALLOWLIST,
  projectBusinessMetadata,
} from "@/lib/indicator-engine/adapters/mapping/metadata-allowlist"
export { mapActivityEngineEventV1ToInput } from "@/lib/indicator-engine/adapters/mapping/map-activity-event-v1"
