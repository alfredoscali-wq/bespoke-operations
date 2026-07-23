import { recordActivityEventClient } from "@/lib/activity/record-activity-event.client"
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
  ACTIVITY_RESULTS,
  type ActivityAction,
  type ActivityGeoInput,
  type ActivityOrigin,
  type ActivityResult,
} from "@/lib/activity/types"
import { resolveActivityActionDefinition } from "@/lib/activity/catalog"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import type { TaskWorkflowAction } from "@/lib/tasks/task-status-workflow"
import type { Task } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"

export type TaskActivityEmission = {
  action: ActivityAction
  detail: string
  metadata?: Record<string, unknown>
  entityId?: string | null
  module?: typeof ACTIVITY_MODULES.TASKS | typeof ACTIVITY_MODULES.PLANNING
  entityType?:
    | typeof ACTIVITY_ENTITY_TYPES.TASK
    | typeof ACTIVITY_ENTITY_TYPES.PLANNING_DAY
  result?: ActivityResult | null
  geo?: ActivityGeoInput | null
  sessionId?: string | null
  durationMs?: number | null
}

function newCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function crewCleared(before: Task, after: Task): boolean {
  const hadCrew = Boolean(before.crewId?.trim() || before.crew?.trim())
  const hasCrew = Boolean(after.crewId?.trim() || after.crew?.trim())
  return hadCrew && !hasCrew
}

function crewChanged(before: Task, after: Task): boolean {
  return (
    (before.crewId ?? null) !== (after.crewId ?? null) ||
    (before.crew?.trim() || "") !== (after.crew?.trim() || "")
  )
}

function scheduleChanged(before: Task, after: Task): boolean {
  return (
    (before.dueDate ?? null) !== (after.dueDate ?? null) ||
    (before.scheduledTime ?? null) !== (after.scheduledTime ?? null)
  )
}

function buildTaskStatusChangeMetadata(before: Task, after: Task) {
  return {
    previousStatus: before.status,
    newStatus: after.status,
  }
}

/** Prefer OIE geo columns when both coordinates are present. */
export function buildTaskGeoFromTask(
  task: Pick<Task, "latitude" | "longitude">
): ActivityGeoInput | null {
  if (
    typeof task.latitude === "number" &&
    typeof task.longitude === "number" &&
    !Number.isNaN(task.latitude) &&
    !Number.isNaN(task.longitude)
  ) {
    return {
      latitude: task.latitude,
      longitude: task.longitude,
    }
  }
  return null
}

export function buildTaskCrewChangeMetadata(before: Task, after: Task) {
  return {
    oldCrew: before.crew?.trim() || null,
    newCrew: after.crew?.trim() || null,
    oldCrewId: before.crewId ?? null,
    newCrewId: after.crewId ?? null,
  }
}

export function buildTaskPriorityChangeMetadata(before: Task, after: Task) {
  return {
    oldPriority: before.priority ?? null,
    newPriority: after.priority ?? null,
  }
}

export function buildTaskRescheduleMetadata(before: Task, after: Task) {
  return {
    oldDate: before.dueDate ?? null,
    newDate: after.dueDate ?? null,
    oldTime: before.scheduledTime ?? null,
    newTime: after.scheduledTime ?? null,
  }
}

/**
 * Status/context metadata for TASK_START.
 * GPS belongs in emission.geo (OIE columns), not duplicated here.
 */
export function buildTaskStartMetadata(input: {
  previousStatus?: string | null
  newStatus?: string | null
  origin?: ActivityOrigin
}) {
  return {
    previousStatus: input.previousStatus ?? null,
    newStatus: input.newStatus ?? null,
    origin: input.origin ?? ACTIVITY_ORIGINS.WEB,
  }
}

export function mapWorkflowActionToActivityEmissions(
  workflowAction: TaskWorkflowAction,
  before: Task,
  after: Task,
  rescheduleInput?: TaskRescheduleInput
): TaskActivityEmission[] {
  switch (workflowAction) {
    case "assign-crew":
      if (crewCleared(before, after)) {
        return [
          {
            action: ACTIVITY_ACTIONS.TASK_UNASSIGN_CREW,
            detail: "Cuadrilla desasignada de la OT.",
            metadata: {
              ...buildTaskCrewChangeMetadata(before, after),
              ...buildTaskStatusChangeMetadata(before, after),
            },
          },
        ]
      }
      return [
        {
          action: ACTIVITY_ACTIONS.TASK_ASSIGN_CREW,
          detail: "Cuadrilla asignada a la OT.",
          metadata: {
            ...buildTaskCrewChangeMetadata(before, after),
            ...buildTaskStatusChangeMetadata(before, after),
          },
        },
      ]
    case "start":
    case "resume-from-incident":
      return [
        {
          action: ACTIVITY_ACTIONS.TASK_START,
          detail: "Ejecución de OT iniciada.",
          metadata: buildTaskStartMetadata({
            previousStatus: before.status,
            newStatus: after.status,
            origin: ACTIVITY_ORIGINS.WEB,
          }),
          geo: buildTaskGeoFromTask(after),
        },
      ]
    case "submit-for-approval":
      return [
        {
          action: ACTIVITY_ACTIONS.TASK_SUBMIT_FOR_APPROVAL,
          detail: "OT enviada a pendiente de cierre.",
          metadata: buildTaskStatusChangeMetadata(before, after),
        },
      ]
    case "approve":
      return [
        {
          action: ACTIVITY_ACTIONS.TASK_APPROVE,
          detail: "OT aprobada / finalizada.",
          result: ACTIVITY_RESULTS.SUCCESS,
          metadata: {
            ...buildTaskStatusChangeMetadata(before, after),
            completedAt: after.completedAt ?? null,
          },
          durationMs: null,
        },
      ]
    case "reject":
      return [
        {
          action: ACTIVITY_ACTIONS.TASK_REJECT,
          detail: "Cierre de OT rechazado.",
          result: ACTIVITY_RESULTS.FAILURE,
          metadata: {
            ...buildTaskStatusChangeMetadata(before, after),
            rejectionReason: after.rejectionReason ?? null,
          },
        },
      ]
    case "cancel":
      return [
        {
          action: ACTIVITY_ACTIONS.TASK_CANCEL,
          detail: "OT cancelada.",
          result: ACTIVITY_RESULTS.CANCELLED,
          metadata: {
            ...buildTaskStatusChangeMetadata(before, after),
            cancellationReason: after.cancellationReason ?? null,
          },
        },
      ]
    case "confirm-planning":
      return [
        {
          action: ACTIVITY_ACTIONS.PLANNING_CONFIRM,
          detail: "Planificación confirmada para la OT.",
          module: ACTIVITY_MODULES.PLANNING,
          entityType: ACTIVITY_ENTITY_TYPES.PLANNING_DAY,
          entityId: null,
          metadata: {
            taskId: after.id,
            dueDate: after.dueDate ?? null,
            crewId: after.crewId ?? null,
          },
        },
      ]
    case "reopen-planning":
    case "return-to-atencion":
      return [
        {
          action: ACTIVITY_ACTIONS.PLANNING_RETURN,
          detail: "OT devuelta a planificación.",
          module: ACTIVITY_MODULES.PLANNING,
          entityType: ACTIVITY_ENTITY_TYPES.TASK,
          metadata: {
            taskId: after.id,
            previousStatus: before.status,
            status: after.status,
          },
        },
      ]
    case "reschedule-from-incident":
    case "reschedule-from-overdue":
    case "reschedule-planning-return":
    case "reschedule-from-active-incident":
    case "reschedule-obra":
      return [
        {
          action: ACTIVITY_ACTIONS.TASK_RESCHEDULE,
          detail: "OT reprogramada.",
          metadata: {
            ...buildTaskRescheduleMetadata(before, after),
            reason: rescheduleInput?.reason ?? after.rescheduleReason ?? null,
          },
        },
      ]
    default:
      return []
  }
}

/**
 * Plans Activity events for a successful OT mutation (post-commit).
 * Multiple related changes share one correlationId.
 */
export function planTaskActivityEmissions(input: {
  before: Task
  after: Task
  payload: UpdateTaskPayload
  workflowAction?: TaskWorkflowAction
  rescheduleInput?: TaskRescheduleInput
}): { correlationId: string; emissions: TaskActivityEmission[] } {
  const { before, after, payload, workflowAction, rescheduleInput } = input
  const emissions: TaskActivityEmission[] = []

  if (workflowAction) {
    emissions.push(
      ...mapWorkflowActionToActivityEmissions(
        workflowAction,
        before,
        after,
        rescheduleInput
      )
    )

    // Planning edit batch: also capture concurrent field changes with same correlation
    if (
      workflowAction === "assign-crew" ||
      workflowAction.startsWith("reschedule")
    ) {
      // already covered
    }

    return { correlationId: newCorrelationId(), emissions }
  }

  if (
    payload.executionOrder !== undefined &&
    (before.executionOrder ?? null) !== (after.executionOrder ?? null)
  ) {
    emissions.push({
      action: ACTIVITY_ACTIONS.PLANNING_ORDER_CHANGE,
      detail: "Orden de ejecución actualizado.",
      module: ACTIVITY_MODULES.PLANNING,
      entityType: ACTIVITY_ENTITY_TYPES.TASK,
      metadata: {
        oldOrder: before.executionOrder ?? null,
        newOrder: after.executionOrder ?? null,
        planningDate: after.dueDate ?? null,
      },
    })
  }

  if (payload.priority !== undefined && before.priority !== after.priority) {
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_PRIORITY_CHANGE,
      detail: "Prioridad de OT actualizada.",
      metadata: buildTaskPriorityChangeMetadata(before, after),
    })
  }

  if (
    payload.estimatedDuration !== undefined &&
    (before.estimatedDuration ?? "") !== (after.estimatedDuration ?? "")
  ) {
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_DURATION_CHANGE,
      detail: "Duración estimada de OT actualizada.",
      metadata: {
        oldDuration: before.estimatedDuration ?? null,
        newDuration: after.estimatedDuration ?? null,
      },
    })
  }

  const materialsBefore = before.taskMetadata?.materialsNeeded
  const materialsAfter = after.taskMetadata?.materialsNeeded
  if (
    payload.taskMetadata !== undefined &&
    String(materialsBefore ?? "").trim() !== String(materialsAfter ?? "").trim()
  ) {
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_MATERIALS_CHANGE,
      detail: "Materiales de OT actualizados.",
      metadata: {
        oldMaterials: materialsBefore ?? null,
        newMaterials: materialsAfter ?? null,
      },
    })
  }

  if (
    (payload.dueDate !== undefined || payload.scheduledTime !== undefined) &&
    scheduleChanged(before, after)
  ) {
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_RESCHEDULE,
      detail: "OT reprogramada.",
      metadata: buildTaskRescheduleMetadata(before, after),
    })
  }

  if (
    payload.crewId !== undefined ||
    payload.crew !== undefined ||
    payload.supervisor !== undefined
  ) {
    if (crewChanged(before, after)) {
      if (crewCleared(before, after)) {
        emissions.push({
          action: ACTIVITY_ACTIONS.TASK_UNASSIGN_CREW,
          detail: "Cuadrilla desasignada de la OT.",
          metadata: buildTaskCrewChangeMetadata(before, after),
        })
      } else {
        emissions.push({
          action: ACTIVITY_ACTIONS.TASK_ASSIGN_CREW,
          detail: "Cuadrilla asignada / cambiada en la OT.",
          metadata: buildTaskCrewChangeMetadata(before, after),
        })
      }
    }
  }

  const specialized = new Set(emissions.map((e) => e.action))
  const hasGenericFieldUpdate = Object.keys(payload).some((key) => {
    if (
      key === "priority" ||
      key === "estimatedDuration" ||
      key === "dueDate" ||
      key === "scheduledTime" ||
      key === "crewId" ||
      key === "crew" ||
      key === "supervisor" ||
      key === "status" ||
      key === "taskMetadata" ||
      key === "executionOrder" ||
      key === "dispatchOrder"
    ) {
      return false
    }
    return payload[key as keyof UpdateTaskPayload] !== undefined
  })

  // taskMetadata-only without materials already handled; other metadata → UPDATE
  const metadataOnlyNonMaterials =
    payload.taskMetadata !== undefined &&
    !specialized.has(ACTIVITY_ACTIONS.TASK_MATERIALS_CHANGE) &&
    Object.keys(payload).every(
      (key) =>
        key === "taskMetadata" ||
        payload[key as keyof UpdateTaskPayload] === undefined
    )

  if (
    (hasGenericFieldUpdate || metadataOnlyNonMaterials) &&
    emissions.length === 0
  ) {
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_UPDATE,
      detail: "OT actualizada.",
      metadata: { fields: Object.keys(payload) },
    })
  } else if (hasGenericFieldUpdate && emissions.length > 0) {
    // Additional generic edits alongside specialized ones — one UPDATE
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_UPDATE,
      detail: "OT actualizada (campos adicionales).",
      metadata: { fields: Object.keys(payload) },
    })
  }

  return { correlationId: newCorrelationId(), emissions }
}

export function emitTaskActivityEvents(input: {
  emissions: TaskActivityEmission[]
  correlationId: string
  taskId: string
  origin?: ActivityOrigin
}): void {
  if (input.emissions.length === 0) {
    return
  }

  const origin = input.origin ?? ACTIVITY_ORIGINS.WEB

  for (const emission of input.emissions) {
    const definition = resolveActivityActionDefinition(emission.action)
    const module = emission.module ?? definition.module
    const entityType = emission.entityType ?? definition.entityType
    const entityId =
      emission.entityId !== undefined
        ? emission.entityId
        : entityType === ACTIVITY_ENTITY_TYPES.TASK
          ? input.taskId
          : null

    void recordActivityEventClient({
      action: emission.action,
      module,
      entityType,
      entityId,
      detail: emission.detail,
      metadata: emission.metadata,
      origin,
      correlationId: input.correlationId,
      severity: definition.severity,
      result: emission.result ?? null,
      geo: emission.geo ?? null,
      sessionId: emission.sessionId ?? null,
      durationMs: emission.durationMs ?? null,
    })
  }
}

/**
 * Plans create-time OIE emissions for a new OT.
 * Sprint mapping: TASK_CREATED→TASK_CREATE, TASK_SCHEDULED→TASK_SCHEDULE,
 * TASK_ASSIGNED→TASK_ASSIGN_CREW (when crew present).
 */
export function planTaskCreateActivityEmissions(
  task: Task
): { correlationId: string; emissions: TaskActivityEmission[] } {
  const correlationId = newCorrelationId()
  const emissions: TaskActivityEmission[] = [
    {
      action: ACTIVITY_ACTIONS.TASK_CREATE,
      detail: "OT creada.",
      metadata: {
        code: task.code,
        status: task.status,
        dueDate: task.dueDate ?? null,
        scheduledTime: task.scheduledTime ?? null,
        crewId: task.crewId ?? null,
        crew: task.crew?.trim() || null,
      },
    },
  ]

  if (task.dueDate?.trim()) {
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_SCHEDULE,
      detail: "OT programada.",
      metadata: {
        dueDate: task.dueDate,
        scheduledTime: task.scheduledTime ?? null,
        status: task.status,
      },
    })
  }

  if (task.crewId?.trim() || task.crew?.trim()) {
    emissions.push({
      action: ACTIVITY_ACTIONS.TASK_ASSIGN_CREW,
      detail: "Cuadrilla asignada en la creación de la OT.",
      metadata: {
        oldCrew: null,
        newCrew: task.crew?.trim() || null,
        oldCrewId: null,
        newCrewId: task.crewId ?? null,
        status: task.status,
      },
    })
  }

  return { correlationId, emissions }
}

export function recordTaskCreateActivity(task: Task): void {
  const planned = planTaskCreateActivityEmissions(task)
  emitTaskActivityEvents({
    emissions: planned.emissions,
    correlationId: planned.correlationId,
    taskId: task.id,
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export function recordTaskDeleteActivity(
  task: Task,
  options?: { administration?: boolean }
): void {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.TASK_DELETE,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: task.id,
    detail: options?.administration
      ? "OT eliminada por administrador (soft delete)."
      : "OT eliminada (soft delete).",
    metadata: {
      code: task.code,
      status: task.status,
      administration: options?.administration === true,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export function recordTaskMutationActivity(input: {
  before: Task
  after: Task
  payload: UpdateTaskPayload
  workflowAction?: TaskWorkflowAction
  rescheduleInput?: TaskRescheduleInput
  origin?: ActivityOrigin
}): void {
  const planned = planTaskActivityEmissions(input)
  emitTaskActivityEvents({
    emissions: planned.emissions,
    correlationId: planned.correlationId,
    taskId: input.after.id,
    origin: input.origin,
  })
}
