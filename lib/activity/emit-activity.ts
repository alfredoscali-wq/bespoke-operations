import "server-only"

import {
  ACTIVITY_EVENT_TITLES,
  type ActivityEventAction,
} from "@/lib/activity/actions"
import { recordActivity } from "@/lib/activity/activity-service"
import type { RecordActivityResult } from "@/lib/activity/activity-types"
import {
  withActivityActor,
  type ActivityActorContext,
} from "@/lib/activity/resolve-activity-actor"

export type EmitActivityInput = {
  actor: ActivityActorContext
  module: string
  entityType: string
  entityId?: string | null
  action: ActivityEventAction
  title?: string
  description?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Domain-facing Activity writer. Always ends in recordActivity().
 * Best-effort: never throws into the calling business flow.
 */
export async function emitActivity(
  input: EmitActivityInput
): Promise<RecordActivityResult | null> {
  return recordActivity(
    withActivityActor(input.actor, {
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      title: input.title ?? ACTIVITY_EVENT_TITLES[input.action],
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    })
  )
}
