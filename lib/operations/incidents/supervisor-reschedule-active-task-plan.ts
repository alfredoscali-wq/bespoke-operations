import {
  buildDispatchOrderDestinationAssignmentUpdates,
  buildDispatchOrderScopeLeaveUpdates,
  type DispatchOrderUpdate,
} from "@/lib/planificacion/planning-dispatch-order"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import {
  buildTaskRescheduleUpdatePayload,
  validateTaskRescheduleInput,
  type TaskRescheduleInput,
} from "@/lib/tasks/reschedule"
import {
  OPERATIONAL_CHECKLIST_RESPONSES_KEY,
} from "@/lib/tasks/operational-checklist-responses"
import type { Crew } from "@/lib/types/crews"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import type { TaskIncidentStatus } from "@/lib/types/task-incidents"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"

type CrewRef = Pick<Crew, "id" | "name">

export const ACTIVE_TASK_INCIDENT_STATUSES: TaskIncidentStatus[] = [
  "REPORTADA",
  "EN_ANALISIS",
]

export type SupervisorRescheduleActiveTaskValidationError = {
  ok: false
  code:
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_STATUS"
    | "INVALID_INCIDENT"
    | "INVALID_CREW"
    | "VALIDATION"
  message: string
}

export type SupervisorRescheduleActiveTaskValidationSuccess = {
  ok: true
}

export type SupervisorRescheduleActiveTaskValidationResult =
  | SupervisorRescheduleActiveTaskValidationSuccess
  | SupervisorRescheduleActiveTaskValidationError

export type SupervisorRescheduleDispatchJsonUpdate = {
  task_id: string
  dispatch_order: number | null
}

export type SupervisorRescheduleActiveTaskPlan = {
  workflowAction: "reschedule-from-active-incident"
  targetStatus: "asignada"
  taskPayload: UpdateTaskPayload
  taskMetadata: Record<string, unknown>
  preDispatchClears: SupervisorRescheduleDispatchJsonUpdate[]
  postDispatchAssignments: SupervisorRescheduleDispatchJsonUpdate[]
  incidentEventComment: string
  rescheduleInput: TaskRescheduleInput
}

export function isActiveTaskIncidentStatus(
  status: TaskIncidentStatus
): boolean {
  return ACTIVE_TASK_INCIDENT_STATUSES.includes(status)
}

export function buildTaskMetadataAfterOperationalChecklistReset(
  task: Pick<Task, "taskMetadata">
): Record<string, unknown> {
  const metadata = { ...(task.taskMetadata ?? {}) }
  delete metadata[OPERATIONAL_CHECKLIST_RESPONSES_KEY]
  return metadata
}

export function validateSupervisorRescheduleActiveTaskPreconditions(input: {
  canSupervise: boolean
  task: Pick<Task, "id" | "status"> | null | undefined
  incident:
    | {
        id: string
        companyId: string
        taskId: string
        status: TaskIncidentStatus
      }
    | null
    | undefined
  companyId: string
  crew: Pick<Crew, "id"> | null | undefined
}): SupervisorRescheduleActiveTaskValidationResult {
  if (!input.canSupervise) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "No tiene permisos para replanificar desde incidencias.",
    }
  }

  if (!input.incident) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Incidencia no encontrada.",
    }
  }

  if (input.incident.companyId !== input.companyId) {
    return {
      ok: false,
      code: "INVALID_INCIDENT",
      message: "La incidencia no pertenece a su empresa.",
    }
  }

  if (!isActiveTaskIncidentStatus(input.incident.status)) {
    return {
      ok: false,
      code: "INVALID_INCIDENT",
      message: "La incidencia no está activa.",
    }
  }

  if (!input.task) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Orden de trabajo no encontrada.",
    }
  }

  if (input.task.id !== input.incident.taskId) {
    return {
      ok: false,
      code: "INVALID_INCIDENT",
      message: "La incidencia no está asociada a esta orden de trabajo.",
    }
  }

  if (input.task.status !== "en-curso") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "La replanificación RC3.1 requiere una OT en estado en-curso.",
    }
  }

  if (!input.crew) {
    return {
      ok: false,
      code: "INVALID_CREW",
      message: "Cuadrilla no encontrada.",
    }
  }

  return { ok: true }
}

function mapDispatchUpdatesToJson(
  updates: DispatchOrderUpdate[]
): SupervisorRescheduleDispatchJsonUpdate[] {
  return updates.map((update) => ({
    task_id: update.taskId,
    dispatch_order: update.dispatchOrder,
  }))
}

function simulateTaskAfterReschedule(input: {
  task: Task
  payload: UpdateTaskPayload
}): Task {
  return {
    ...input.task,
    status: (input.payload.status ?? input.task.status) as TaskStatus,
    dueDate: input.payload.dueDate ?? input.task.dueDate,
    crewId:
      input.payload.crewId !== undefined
        ? input.payload.crewId ?? undefined
        : input.task.crewId,
    crew: input.payload.crew ?? input.task.crew,
    dispatchOrder:
      input.payload.dispatchOrder !== undefined
        ? input.payload.dispatchOrder
        : null,
    executionOrder:
      input.payload.executionOrder !== undefined
        ? input.payload.executionOrder
        : null,
  }
}

export function buildSupervisorRescheduleActiveTaskPlan(input: {
  task: Task
  allTasks: Task[]
  rescheduleInput: TaskRescheduleInput
  crews: CrewRef[]
  referenceDate?: Date
}): SupervisorRescheduleActiveTaskPlan | SupervisorRescheduleActiveTaskValidationError {
  const scheduleValidation = validateTaskRescheduleInput(
    {
      dueDate: input.rescheduleInput.dueDate,
      scheduledTime: input.rescheduleInput.scheduledTime,
      reason: input.rescheduleInput.reason,
    },
    input.referenceDate
  )

  if (!scheduleValidation.allowed) {
    return {
      ok: false,
      code: "VALIDATION",
      message: scheduleValidation.message ?? "Datos de reprogramación inválidos.",
    }
  }

  const rescheduledBy = input.rescheduleInput.rescheduledBy.trim()
  if (!rescheduledBy) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "No se pudo identificar al usuario que reprograma.",
    }
  }

  const nextCrewId =
    input.rescheduleInput.crewId ?? resolveTaskCrewId(input.task, input.crews)

  if (!nextCrewId) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Debe seleccionar una cuadrilla para replanificar.",
    }
  }

  const normalizedInput: TaskRescheduleInput = {
    ...input.rescheduleInput,
    rescheduledBy,
    crewId: nextCrewId,
  }

  const taskPayload = buildTaskRescheduleUpdatePayload(
    input.task,
    normalizedInput,
    "asignada"
  )

  taskPayload.executionOrder = null
  taskPayload.dispatchOrder = null

  const taskMetadata = buildTaskMetadataAfterOperationalChecklistReset(input.task)
  taskPayload.taskMetadata = taskMetadata

  const preDispatchClears = buildDispatchOrderScopeLeaveUpdates({
    task: input.task,
  })

  const simulatedTask = simulateTaskAfterReschedule({
    task: input.task,
    payload: taskPayload,
  })

  const simulatedTasks = input.allTasks.map((item) =>
    item.id === input.task.id ? simulatedTask : item
  )

  const postDispatchAssignments = buildDispatchOrderDestinationAssignmentUpdates({
    tasks: simulatedTasks,
    dueDate: taskPayload.dueDate ?? input.task.dueDate,
    crewId: nextCrewId,
    taskId: input.task.id,
    crews: input.crews,
  })

  const incidentEventComment =
    normalizedInput.notes?.trim() ||
    normalizedInput.reason.trim() ||
    "OT replanificada desde incidencia activa."

  return {
    workflowAction: "reschedule-from-active-incident",
    targetStatus: "asignada",
    taskPayload,
    taskMetadata,
    preDispatchClears: mapDispatchUpdatesToJson(preDispatchClears),
    postDispatchAssignments: mapDispatchUpdatesToJson(postDispatchAssignments),
    incidentEventComment,
    rescheduleInput: normalizedInput,
  }
}

export function describeSupervisorRescheduleOperationalOrders(input: {
  originDueDate: string
  originCrewId: string | null
  destinationDueDate: string
  destinationCrewId: string
  preDispatchClears: SupervisorRescheduleDispatchJsonUpdate[]
  postDispatchAssignments: SupervisorRescheduleDispatchJsonUpdate[]
}): {
  scenario:
    | "same-date-same-crew"
    | "new-date-same-crew"
    | "same-date-new-crew"
    | "new-date-new-crew"
  executionOrder: null
  dispatchOrder: number | null
} {
  const sameDate = input.originDueDate === input.destinationDueDate
  const sameCrew =
    input.originCrewId != null &&
    input.originCrewId === input.destinationCrewId

  let scenario:
    | "same-date-same-crew"
    | "new-date-same-crew"
    | "same-date-new-crew"
    | "new-date-new-crew"

  if (sameDate && sameCrew) {
    scenario = "same-date-same-crew"
  } else if (!sameDate && sameCrew) {
    scenario = "new-date-same-crew"
  } else if (sameDate && !sameCrew) {
    scenario = "same-date-new-crew"
  } else {
    scenario = "new-date-new-crew"
  }

  return {
    scenario,
    executionOrder: null,
    dispatchOrder:
      input.postDispatchAssignments.find(
        (update) => update.dispatch_order != null
      )?.dispatch_order ?? null,
  }
}
