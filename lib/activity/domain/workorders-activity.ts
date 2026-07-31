import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"

const MODULE = "tasks"
const ENTITY_TYPE = "workorder"

export function recordWorkOrderCreatedActivity(input: {
  workOrderId: string
  status?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_CREATED,
    metadata: {
      status: input.status ?? null,
    },
  })
}

export function recordWorkOrderUpdatedActivity(input: {
  workOrderId: string
  changedFields?: string[]
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_UPDATED,
    metadata: {
      changedFields: input.changedFields ?? [],
    },
  })
}

export function recordWorkOrderScheduledActivity(input: {
  workOrderId: string
  scheduledDate?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_SCHEDULED,
    metadata: {
      scheduledDate: input.scheduledDate ?? null,
    },
  })
}

export function recordWorkOrderAssignedActivity(input: {
  workOrderId: string
  oldCrewId?: string | null
  newCrewId?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_ASSIGNED,
    metadata: {
      oldCrewId: input.oldCrewId ?? null,
      newCrewId: input.newCrewId ?? null,
    },
  })
}

export function recordWorkOrderRescheduledActivity(input: {
  workOrderId: string
  oldDate?: string | null
  newDate?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_RESCHEDULED,
    metadata: {
      oldDate: input.oldDate ?? null,
      newDate: input.newDate ?? null,
    },
  })
}

export function recordWorkOrderCrewChangedActivity(input: {
  workOrderId: string
  oldCrewId: string | null
  newCrewId: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_CREW_CHANGED,
    metadata: {
      oldCrewId: input.oldCrewId,
      newCrewId: input.newCrewId,
    },
  })
}

export function recordWorkOrderPriorityChangedActivity(input: {
  workOrderId: string
  oldPriority: string | null
  newPriority: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_PRIORITY_CHANGED,
    metadata: {
      oldPriority: input.oldPriority,
      newPriority: input.newPriority,
    },
  })
}

export function recordWorkOrderStartedActivityClient(input: {
  workOrderId: string
  oldStatus?: string | null
  newStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_STARTED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: input.newStatus ?? null,
    },
  })
}

export function recordWorkOrderPausedActivity(input: {
  workOrderId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_PAUSED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "paused",
    },
  })
}

export function recordWorkOrderResumedActivity(input: {
  workOrderId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_RESUMED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "in_progress",
    },
  })
}

export function recordWorkOrderFinishedActivity(input: {
  workOrderId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_FINISHED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "finished",
    },
  })
}

export function recordWorkOrderCancelledActivity(input: {
  workOrderId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.WORKORDER_CANCELLED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "cancelled",
    },
  })
}
