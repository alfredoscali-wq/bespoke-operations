import "server-only"

import { activity } from "@/lib/activity-engine/activity-engine"
import {
  ACTIVITY_ACTIONS,
} from "@/lib/activity-engine/activity-actions"
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
  ACTIVITY_ORIGINS,
} from "@/lib/activity-engine/activity-types"
import type { PresenceEventType } from "@/lib/presence/constants"

const PRESENCE_ACTIVITY_MODULE = "presence"
const PRESENCE_ACTIVITY_ENTITY_TYPE = "task"

/**
 * Presence → Activity Engine bridge (ADR-009).
 * Only ENTER_RADIUS / EXIT_RADIUS — never HEARTBEAT.
 * Always ends in `activity.record()`.
 */
export async function registerPresenceActivitySafe(input: {
  companyId: string
  taskId: string
  employeeId: string
  eventType: PresenceEventType
  distanceMeters: number
  operationalRadiusMeters: number
  targetSource: "task" | "project"
  latitude: number
  longitude: number
  deviceId: string
  presenceEventId: string
}): Promise<void> {
  if (input.eventType === "HEARTBEAT") {
    return
  }

  const isEnter = input.eventType === "ENTER_RADIUS"
  const action = isEnter
    ? ACTIVITY_ACTIONS.PRESENCE_ENTER_RADIUS
    : ACTIVITY_ACTIONS.PRESENCE_EXIT_RADIUS

  try {
    const result = await activity.record({
      companyId: input.companyId,
      module: PRESENCE_ACTIVITY_MODULE,
      entityType: PRESENCE_ACTIVITY_ENTITY_TYPE,
      entityId: input.taskId,
      employeeId: input.employeeId,
      action,
      category: ACTIVITY_CATEGORIES.OPERATIONAL,
      impact: ACTIVITY_IMPACTS.PRODUCTION,
      origin: ACTIVITY_ORIGINS.INTEGRATION,
      title: isEnter ? "Ingreso al radio operativo" : "Salida del radio operativo",
      description: isEnter
        ? "El operario ingresó al radio operativo de la orden de trabajo."
        : "El operario salió del radio operativo de la orden de trabajo.",
      metadata: {
        presence_event_id: input.presenceEventId,
        presence_event_type: input.eventType,
        distance_meters: Math.round(input.distanceMeters),
        operational_radius_meters: input.operationalRadiusMeters,
        target_source: input.targetSource,
        latitude: input.latitude,
        longitude: input.longitude,
        device_id: input.deviceId,
      },
    })

    if (!result.ok) {
      console.warn("[presence/activity] registro omitido", {
        action,
        taskId: input.taskId,
        error: result.error,
      })
    }
  } catch (error) {
    console.warn("[presence/activity] error al registrar", {
      action,
      taskId: input.taskId,
      error,
    })
  }
}
