import { buildDispatchOrderScopeLeaveUpdates } from "@/lib/planificacion/planning-dispatch-order"
import { TASK_INCIDENT_COMMENT_MAX_LENGTH } from "@/lib/task-incidents/validate-task-incident-input"
import type { Task } from "@/lib/types/tasks"
import type { TaskIncidentStatus } from "@/lib/types/task-incidents"

import {
  buildTaskMetadataAfterOperationalChecklistReset,
  isActiveTaskIncidentStatus,
} from "./supervisor-reschedule-active-task-plan"

export const SUPERVISOR_RESOLVE_ACTIONS = {
  CONTINUE: "continue",
  REPROGRAM: "reprogram",
  CANCEL: "cancel",
} as const

export type SupervisorResolveAction =
  (typeof SUPERVISOR_RESOLVE_ACTIONS)[keyof typeof SUPERVISOR_RESOLVE_ACTIONS]

export type SupervisorResolveActiveIncidentRequest = {
  action: SupervisorResolveAction
  message?: string
  reason?: string
}

export type SupervisorResolveValidationError = {
  ok: false
  code:
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_STATUS"
    | "INVALID_INCIDENT"
    | "VALIDATION"
  message: string
}

export type SupervisorResolveValidationSuccess = { ok: true }

export type SupervisorResolveValidationResult =
  | SupervisorResolveValidationSuccess
  | SupervisorResolveValidationError

export type SupervisorResolveDispatchJsonUpdate = {
  task_id: string
  dispatch_order: number | null
}

export type SupervisorResolveActiveIncidentPlan = {
  action: SupervisorResolveAction
  comment: string
  taskMetadata: Record<string, unknown> | null
  preDispatchClears: SupervisorResolveDispatchJsonUpdate[]
  cancellationReason: string | null
  cancellationObservation: string | null
  targetTaskStatus: "en-curso" | "programada" | "cancelada"
  incidentEventType: "CONTINUE" | "RESCHEDULE" | "CANCEL_TASK"
}

const RESOLVE_ACTIONS = new Set<string>(Object.values(SUPERVISOR_RESOLVE_ACTIONS))

export function normalizeSupervisorResolveAction(
  value: unknown
): SupervisorResolveAction | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return RESOLVE_ACTIONS.has(normalized)
    ? (normalized as SupervisorResolveAction)
    : null
}

function validateRequiredText(
  value: unknown,
  fieldLabel: string
): { ok: true; value: string } | SupervisorResolveValidationError {
  if (typeof value !== "string") {
    return {
      ok: false,
      code: "VALIDATION",
      message: `${fieldLabel} es obligatorio.`,
    }
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `${fieldLabel} es obligatorio.`,
    }
  }

  if (trimmed.length > TASK_INCIDENT_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `${fieldLabel} supera el límite de ${TASK_INCIDENT_COMMENT_MAX_LENGTH} caracteres.`,
    }
  }

  return { ok: true, value: trimmed }
}

export function validateSupervisorResolveActiveIncidentPreconditions(input: {
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
}): SupervisorResolveValidationResult {
  if (!input.canSupervise) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "No tiene permisos para resolver incidencias.",
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
      message: "La resolución requiere una OT en estado en-curso.",
    }
  }

  return { ok: true }
}

function mapDispatchUpdatesToJson(
  updates: ReturnType<typeof buildDispatchOrderScopeLeaveUpdates>
): SupervisorResolveDispatchJsonUpdate[] {
  return updates.map((update) => ({
    task_id: update.taskId,
    dispatch_order: update.dispatchOrder,
  }))
}

export function validateSupervisorResolveActiveIncidentRequest(
  body: unknown
): SupervisorResolveActiveIncidentRequest | SupervisorResolveValidationError {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Cuerpo JSON inválido.",
    }
  }

  const record = body as Record<string, unknown>
  const action = normalizeSupervisorResolveAction(record.action)

  if (!action) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Acción de resolución inválida.",
    }
  }

  if (action === SUPERVISOR_RESOLVE_ACTIONS.CONTINUE) {
    const message = validateRequiredText(record.message, "El mensaje")
    if (!message.ok) {
      return message
    }

    return {
      action,
      message: message.value,
    }
  }

  const reason = validateRequiredText(record.reason, "El motivo")
  if (!reason.ok) {
    return reason
  }

  return {
    action,
    reason: reason.value,
  }
}

export function buildSupervisorResolveActiveIncidentPlan(input: {
  task: Task
  request: SupervisorResolveActiveIncidentRequest
}): SupervisorResolveActiveIncidentPlan {
  const preDispatchClears = mapDispatchUpdatesToJson(
    buildDispatchOrderScopeLeaveUpdates({ task: input.task })
  )

  if (input.request.action === SUPERVISOR_RESOLVE_ACTIONS.CONTINUE) {
    return {
      action: input.request.action,
      comment: input.request.message!.trim(),
      taskMetadata: null,
      preDispatchClears: [],
      cancellationReason: null,
      cancellationObservation: null,
      targetTaskStatus: "en-curso",
      incidentEventType: "CONTINUE",
    }
  }

  if (input.request.action === SUPERVISOR_RESOLVE_ACTIONS.REPROGRAM) {
    return {
      action: input.request.action,
      comment: input.request.reason!.trim(),
      taskMetadata: buildTaskMetadataAfterOperationalChecklistReset(input.task),
      preDispatchClears,
      cancellationReason: null,
      cancellationObservation: null,
      targetTaskStatus: "programada",
      incidentEventType: "RESCHEDULE",
    }
  }

  return {
    action: input.request.action,
    comment: input.request.reason!.trim(),
    taskMetadata: null,
    preDispatchClears,
    cancellationReason: "otro",
    cancellationObservation: input.request.reason!.trim(),
    targetTaskStatus: "cancelada",
    incidentEventType: "CANCEL_TASK",
  }
}

export function buildTaskAfterResolve(input: {
  before: Task
  plan: SupervisorResolveActiveIncidentPlan
}): Task {
  if (input.plan.action === SUPERVISOR_RESOLVE_ACTIONS.CONTINUE) {
    return input.before
  }

  if (input.plan.action === SUPERVISOR_RESOLVE_ACTIONS.REPROGRAM) {
    return {
      ...input.before,
      status: "programada",
      crewId: undefined,
      crew: "",
      scheduledTime: undefined,
      executionOrder: null,
      dispatchOrder: null,
      taskMetadata: input.plan.taskMetadata ?? input.before.taskMetadata,
    }
  }

  return {
    ...input.before,
    status: "cancelada",
    executionOrder: null,
    dispatchOrder: null,
    cancellationReason: input.plan.cancellationReason ?? undefined,
    cancellationObservation: input.plan.cancellationObservation ?? undefined,
  }
}

export function isProtectedEnCursoToProgramadaTransitionAllowed(
  contextFlag: string | null | undefined
): boolean {
  return contextFlag === "on"
}
