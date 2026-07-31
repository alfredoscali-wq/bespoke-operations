import "server-only"

import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivity } from "@/lib/activity/emit-activity"
import type { ActivityActorContext } from "@/lib/activity/resolve-activity-actor"

const MODULE = "atencion"
const ENTITY_TYPE = "attention"

export async function recordAttentionCreatedActivity(input: {
  actor: ActivityActorContext
  attentionId: string
  status?: string | null
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.attentionId,
    action: ACTIVITY_EVENT_ACTIONS.ATTENTION_CREATED,
    metadata: {
      status: input.status ?? null,
    },
  })
}

export async function recordAttentionUpdatedActivity(input: {
  actor: ActivityActorContext
  attentionId: string
  changedFields?: string[]
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.attentionId,
    action: ACTIVITY_EVENT_ACTIONS.ATTENTION_UPDATED,
    metadata: {
      changedFields: input.changedFields ?? [],
    },
  })
}

export async function recordAttentionStatusChangedActivity(input: {
  actor: ActivityActorContext
  attentionId: string
  oldStatus: string | null
  newStatus: string | null
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.attentionId,
    action: ACTIVITY_EVENT_ACTIONS.ATTENTION_STATUS_CHANGED,
    metadata: {
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
    },
  })
}

export async function recordAttentionTransferredActivity(input: {
  actor: ActivityActorContext
  attentionId: string
  oldEmployeeId?: string | null
  newEmployeeId?: string | null
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.attentionId,
    action: ACTIVITY_EVENT_ACTIONS.ATTENTION_TRANSFERRED,
    metadata: {
      oldEmployeeId: input.oldEmployeeId ?? null,
      newEmployeeId: input.newEmployeeId ?? null,
    },
  })
}

export async function recordAttentionResolvedActivity(input: {
  actor: ActivityActorContext
  attentionId: string
  oldStatus?: string | null
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.attentionId,
    action: ACTIVITY_EVENT_ACTIONS.ATTENTION_RESOLVED,
    metadata: {
      oldStatus: input.oldStatus ?? null,
      newStatus: "resolved",
    },
  })
}

export async function recordAttentionWorkOrderGeneratedActivity(input: {
  actor: ActivityActorContext
  attentionId: string
  workOrderId: string
}): Promise<void> {
  await emitActivity({
    actor: input.actor,
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.attentionId,
    action: ACTIVITY_EVENT_ACTIONS.ATTENTION_WORKORDER_GENERATED,
    metadata: {
      workOrderId: input.workOrderId,
    },
  })
}
