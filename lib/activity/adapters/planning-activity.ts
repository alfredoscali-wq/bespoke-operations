import { recordActivityEventClient } from "@/lib/activity/record-activity-event.client"
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
} from "@/lib/activity/types"

function newCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function recordPlanningConfirmActivity(input: {
  date: string
  taskCount: number
  crewName?: string
  scope?: "crew" | "journey"
  taskIds?: string[]
}): void {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.PLANNING_CONFIRM,
    module: ACTIVITY_MODULES.PLANNING,
    entityType: ACTIVITY_ENTITY_TYPES.PLANNING_DAY,
    entityId: null,
    detail:
      input.scope === "crew" && input.crewName?.trim()
        ? `Planificación confirmada para ${input.crewName.trim()}.`
        : "Jornada de planificación confirmada.",
    metadata: {
      planningDate: input.date,
      taskCount: input.taskCount,
      crewName: input.crewName ?? null,
      scope: input.scope ?? "journey",
      taskIds: input.taskIds ?? null,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export function recordPlanningOrderChangeActivity(input: {
  correlationId?: string
  taskId: string
  oldOrder: number | null
  newOrder: number | null
  planningDate?: string | null
}): void {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.PLANNING_ORDER_CHANGE,
    module: ACTIVITY_MODULES.PLANNING,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    detail: "Orden de ejecución actualizado.",
    metadata: {
      oldOrder: input.oldOrder,
      newOrder: input.newOrder,
      planningDate: input.planningDate ?? null,
    },
    origin: ACTIVITY_ORIGINS.WEB,
    correlationId: input.correlationId ?? newCorrelationId(),
  })
}

export function recordPlanningCrewChangeActivity(input: {
  correlationId?: string
  taskId: string
  oldCrewId: string | null
  newCrewId: string | null
  oldCrew?: string | null
  newCrew?: string | null
}): void {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.PLANNING_CREW_CHANGE,
    module: ACTIVITY_MODULES.PLANNING,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    detail: "Cuadrilla cambiada desde planificación.",
    metadata: {
      oldCrew: input.oldCrew ?? null,
      newCrew: input.newCrew ?? null,
      oldCrewId: input.oldCrewId,
      newCrewId: input.newCrewId,
    },
    origin: ACTIVITY_ORIGINS.WEB,
    correlationId: input.correlationId ?? newCorrelationId(),
  })
}

export function recordPlanningReturnActivity(input: {
  taskId: string
  reason?: string | null
}): void {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.PLANNING_RETURN,
    module: ACTIVITY_MODULES.PLANNING,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    detail: "OT devuelta a planificación.",
    metadata: {
      reason: input.reason ?? null,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export { newCorrelationId as newPlanningCorrelationId }
