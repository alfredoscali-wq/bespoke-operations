import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"

const MODULE = "planning"
const ENTITY_TYPE = "workorder"

export function recordPlanningOrderChangedActivity(input: {
  workOrderId: string
  oldOrder: number | null
  newOrder: number | null
  planningDate?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.PLANNING_ORDER_CHANGED,
    metadata: {
      oldOrder: input.oldOrder,
      newOrder: input.newOrder,
      planningDate: input.planningDate ?? null,
    },
  })
}

export function recordPlanningDateChangedActivity(input: {
  workOrderId: string
  oldDate: string | null
  newDate: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.PLANNING_DATE_CHANGED,
    metadata: {
      oldDate: input.oldDate,
      newDate: input.newDate,
    },
  })
}

export function recordPlanningShiftChangedActivity(input: {
  workOrderId: string
  oldShift: string | null
  newShift: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.PLANNING_SHIFT_CHANGED,
    metadata: {
      oldShift: input.oldShift,
      newShift: input.newShift,
    },
  })
}

export function recordPlanningDurationChangedActivity(input: {
  workOrderId: string
  oldDuration: number | null
  newDuration: number | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.PLANNING_DURATION_CHANGED,
    metadata: {
      oldDuration: input.oldDuration,
      newDuration: input.newDuration,
    },
  })
}

export function recordPlanningAssignmentChangedActivity(input: {
  workOrderId: string
  oldCrewId: string | null
  newCrewId: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.workOrderId,
    action: ACTIVITY_EVENT_ACTIONS.PLANNING_ASSIGNMENT_CHANGED,
    metadata: {
      oldCrewId: input.oldCrewId,
      newCrewId: input.newCrewId,
    },
  })
}
