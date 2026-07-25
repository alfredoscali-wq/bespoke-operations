/**
 * Activity Engine 1.1A — foundation public surface.
 *
 * Independent of domain modules (Atención, OT, RRHH, Ventas, etc.).
 * Write only through `activity.record()` (server-only).
 */

export { activity } from "@/lib/activity-engine/activity-engine"
export {
  ACTIVITY_ACTIONS,
  isActivityAction,
  listActivityActions,
  type ActivityAction,
} from "@/lib/activity-engine/activity-actions"
export {
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
  ACTIVITY_ORIGINS,
  isActivityCategory,
  isActivityImpact,
  isActivityOrigin,
  type ActivityCategory,
  type ActivityEngineError,
  type ActivityEngineEvent,
  type ActivityEngineRecordInput,
  type ActivityEngineRecordResult,
  type ActivityImpact,
  type ActivityOrigin,
} from "@/lib/activity-engine/activity-types"
export {
  normalizeActivityRecordInput,
  validateActivityRecordInput,
} from "@/lib/activity-engine/activity-validate"
export { persistActivityRecordWithClient } from "@/lib/activity-engine/activity-persist-core"
export { persistActivityRecord } from "@/lib/activity-engine/activity-service"
