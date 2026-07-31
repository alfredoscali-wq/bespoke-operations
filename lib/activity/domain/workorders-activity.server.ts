import "server-only"

import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivity } from "@/lib/activity/emit-activity"
import type { ActivityActorContext } from "@/lib/activity/resolve-activity-actor"

const MODULE = "tasks"
const ENTITY_TYPE = "workorder"

export async function recordWorkOrderStartedActivity(input: {
  actor: ActivityActorContext
  workOrderId: string
  oldStatus?: string | null
  newStatus?: string | null
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
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
