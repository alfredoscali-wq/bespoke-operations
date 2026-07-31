import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"

const MODULE = "requests"
const ENTITY_TYPE = "request"

export function recordRequestCreatedActivity(input: {
  requestId: string
  status?: string | null
  priority?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.requestId,
    action: ACTIVITY_EVENT_ACTIONS.REQUEST_CREATED,
    metadata: {
      status: input.status ?? null,
      priority: input.priority ?? null,
    },
  })
}

export function recordRequestUpdatedActivity(input: {
  requestId: string
  changedFields?: string[]
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.requestId,
    action: ACTIVITY_EVENT_ACTIONS.REQUEST_UPDATED,
    metadata: {
      changedFields: input.changedFields ?? [],
    },
  })
}

export function recordRequestPriorityChangedActivity(input: {
  requestId: string
  oldPriority: string | null
  newPriority: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.requestId,
    action: ACTIVITY_EVENT_ACTIONS.REQUEST_PRIORITY_CHANGED,
    metadata: {
      oldPriority: input.oldPriority,
      newPriority: input.newPriority,
    },
  })
}

export function recordRequestStatusChangedActivity(input: {
  requestId: string
  oldStatus: string | null
  newStatus: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.requestId,
    action: ACTIVITY_EVENT_ACTIONS.REQUEST_STATUS_CHANGED,
    metadata: {
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
    },
  })
}

export function recordRequestResolvedActivity(input: {
  requestId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.requestId,
    action: ACTIVITY_EVENT_ACTIONS.REQUEST_RESOLVED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "resolved",
    },
  })
}

export function recordRequestCancelledActivity(input: {
  requestId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.requestId,
    action: ACTIVITY_EVENT_ACTIONS.REQUEST_CANCELLED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "cancelled",
    },
  })
}

export function recordRequestWorkOrderGeneratedActivity(input: {
  requestId: string
  workOrderId: string
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.requestId,
    action: ACTIVITY_EVENT_ACTIONS.REQUEST_WORKORDER_GENERATED,
    metadata: {
      workOrderId: input.workOrderId,
    },
  })
}
