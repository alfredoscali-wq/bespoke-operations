import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"

const MODULE = "projects"
const ENTITY_TYPE = "project"

export function recordProjectCreatedActivity(input: {
  projectId: string
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.projectId,
    action: ACTIVITY_EVENT_ACTIONS.PROJECT_CREATED,
  })
}

export function recordProjectUpdatedActivity(input: {
  projectId: string
  changedFields?: string[]
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.projectId,
    action: ACTIVITY_EVENT_ACTIONS.PROJECT_UPDATED,
    metadata: {
      changedFields: input.changedFields ?? [],
    },
  })
}

export function recordProjectPausedActivity(input: {
  projectId: string
  oldStatus?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.projectId,
    action: ACTIVITY_EVENT_ACTIONS.PROJECT_PAUSED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "paused",
    },
  })
}

export function recordProjectSupervisorChangedActivity(input: {
  projectId: string
  oldSupervisorEmployeeId?: string | null
  newSupervisorEmployeeId?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.projectId,
    action: ACTIVITY_EVENT_ACTIONS.PROJECT_SUPERVISOR_CHANGED,
    metadata: {
      oldSupervisorEmployeeId: input.oldSupervisorEmployeeId ?? null,
      newSupervisorEmployeeId: input.newSupervisorEmployeeId ?? null,
      changedField: "supervisor",
    },
  })
}
