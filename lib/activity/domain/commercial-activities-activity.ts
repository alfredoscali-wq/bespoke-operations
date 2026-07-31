import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"

const MODULE = "commercial"
const ENTITY_TYPE = "commercial_activity"

export function recordCommercialActivityCreatedActivity(input: {
  activityId: string
  status?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.activityId,
    action: ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_CREATED,
    metadata: {
      status: input.status ?? null,
    },
  })
}

export function recordCommercialActivityUpdatedActivity(input: {
  activityId: string
  changedFields?: string[]
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.activityId,
    action: ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_UPDATED,
    metadata: {
      changedFields: input.changedFields ?? [],
    },
  })
}

export function recordCommercialActivityDeletedActivity(input: {
  activityId: string
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.activityId,
    action: ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_DELETED,
  })
}

export function recordCommercialActivityCompletedActivity(input: {
  activityId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.activityId,
    action: ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_COMPLETED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "completed",
    },
  })
}
