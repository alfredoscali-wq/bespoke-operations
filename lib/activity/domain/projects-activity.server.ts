import "server-only"

import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivity } from "@/lib/activity/emit-activity"
import type { ActivityActorContext } from "@/lib/activity/resolve-activity-actor"

const MODULE = "projects"
const ENTITY_TYPE = "project"

export async function recordProjectStartedActivity(input: {
  actor: ActivityActorContext
  projectId: string
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.projectId,
    action: ACTIVITY_EVENT_ACTIONS.PROJECT_STARTED,
  })
}

export async function recordProjectFinishedActivity(input: {
  actor: ActivityActorContext
  projectId: string
  oldStatus?: string | null
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.projectId,
    action: ACTIVITY_EVENT_ACTIONS.PROJECT_FINISHED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "finished",
    },
  })
}
