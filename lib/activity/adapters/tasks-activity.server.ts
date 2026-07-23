import "server-only"

import { recordActivitySafe } from "@/lib/activity/activity-service"
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
} from "@/lib/activity/types"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import type { Task } from "@/lib/types/tasks"

/**
 * OIE instrumentation for Field Agent task start (server-side).
 * Best-effort — never throws to callers.
 */
export async function recordTaskMobileStartActivity(input: {
  auth: MobileAuthContext
  before: Task
  after: Task
  workTeamId: string
  workTeamName: string
  mobileDeviceId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  distanceToClientMeters: number
}): Promise<void> {
  await recordActivitySafe({
    companyId: input.auth.companyId,
    employeeId: input.auth.employeeId,
    actorType: ACTIVITY_ACTOR_TYPES.EMPLOYEE,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: input.after.id,
    action: ACTIVITY_ACTIONS.TASK_START,
    detail: "Ejecución de OT iniciada (Field Agent).",
    origin: ACTIVITY_ORIGINS.MOBILE,
    geo: {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyM: input.accuracyMeters,
    },
    client: {
      deviceId: input.mobileDeviceId,
    },
    metadata: {
      previousStatus: input.before.status,
      newStatus: input.after.status,
      code: input.after.code,
      workTeamId: input.workTeamId,
      workTeamName: input.workTeamName,
      distanceToClientMeters: input.distanceToClientMeters,
      source: "mobile-field-agent",
    },
  })
}

/**
 * OIE instrumentation for Field Agent submit-for-approval.
 */
export async function recordTaskMobileSubmitActivity(input: {
  auth: MobileAuthContext
  before: Task
  after: Task
  workTeamId: string
  workTeamName: string
  mobileDeviceId: string
}): Promise<void> {
  await recordActivitySafe({
    companyId: input.auth.companyId,
    employeeId: input.auth.employeeId,
    actorType: ACTIVITY_ACTOR_TYPES.EMPLOYEE,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: input.after.id,
    action: ACTIVITY_ACTIONS.TASK_SUBMIT_FOR_APPROVAL,
    detail: "OT enviada a pendiente de cierre (Field Agent).",
    origin: ACTIVITY_ORIGINS.MOBILE,
    client: {
      deviceId: input.mobileDeviceId,
    },
    metadata: {
      previousStatus: input.before.status,
      newStatus: input.after.status,
      code: input.after.code,
      workTeamId: input.workTeamId,
      workTeamName: input.workTeamName,
      source: "mobile-field-agent",
    },
  })
}
