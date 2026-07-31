import {
  ACTIVITY_EVENT_TITLES,
  type ActivityEventAction,
} from "@/lib/activity/actions"
import { recordActivityClient } from "@/lib/activity/record-activity.client"

export type EmitActivityClientInput = {
  module: string
  entityType: string
  entityId?: string | null
  action: ActivityEventAction
  title?: string
  description?: string | null
  metadata?: Record<string, unknown>
}

/** Fire-and-forget client Activity emission. Never throws. */
export function emitActivityClient(input: EmitActivityClientInput): void {
  void recordActivityClient({
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    action: input.action,
    title: input.title ?? ACTIVITY_EVENT_TITLES[input.action],
    description: input.description ?? null,
    metadata: input.metadata ?? {},
  })
}
