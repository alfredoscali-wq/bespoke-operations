import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { hasOperationalSteps, isOperationalStepComplete } from "@/lib/operational-steps/utils"
import { TASK_VENCIDA_START_BLOCKED_MESSAGE } from "@/lib/operations/user-messages"
import type { ChecklistItem, OperationalStep, Task, TaskStatus } from "@/lib/types/tasks"

export type TaskWorkflowAction =
  | "assign-crew"
  | "confirm-planning"
  | "reopen-planning"
  | "start"
  | "submit-for-approval"
  | "report-incident"
  | "resume-from-incident"
  | "reschedule-from-incident"
  | "reschedule-from-overdue"
  | "approve"
  | "reject"
  | "close"
  | "cancel"

export const PENDING_CLOSURE_STATUSES: TaskStatus[] = [
  "pendiente-cierre",
  "en-aprobacion",
]

export function isPendingClosureStatus(status: TaskStatus): boolean {
  return PENDING_CLOSURE_STATUSES.includes(status)
}

function getIncompleteChecklistItems(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => !item.completed)
}

const WORKFLOW_TRANSITIONS: Record<
  TaskWorkflowAction,
  { from: TaskStatus[]; to: TaskStatus }
> = {
  "assign-crew": { from: ["programada"], to: "asignada" },
  "confirm-planning": { from: ["programada"], to: "asignada" },
  "reopen-planning": { from: ["asignada"], to: "programada" },
  start: { from: ["asignada"], to: "en-curso" },
  "submit-for-approval": { from: ["en-curso"], to: "pendiente-cierre" },
  "report-incident": { from: ["en-curso"], to: "incidencia" },
  "resume-from-incident": { from: ["incidencia"], to: "en-curso" },
  "reschedule-from-incident": { from: ["incidencia"], to: "asignada" },
  "reschedule-from-overdue": { from: ["vencida"], to: "asignada" },
  approve: { from: PENDING_CLOSURE_STATUSES, to: "finalizada" },
  reject: { from: PENDING_CLOSURE_STATUSES, to: "en-curso" },
  close: { from: ["finalizada"], to: "cerrada" },
  cancel: {
    from: [
      "programada",
      "asignada",
      "vencida",
      "en-curso",
      "incidencia",
      "pendiente-cierre",
      "en-aprobacion",
    ],
    to: "cancelada",
  },
}

/** OT recién creada: siempre Programada, aunque incluya cuadrilla sugerida. */
export function getInitialTaskStatus(_input?: {
  crewId?: string | null
  crew?: string
}): TaskStatus {
  return "programada"
}

export function getTransitionForAction(action: TaskWorkflowAction): {
  from: TaskStatus[]
  to: TaskStatus
} {
  return WORKFLOW_TRANSITIONS[action]
}

export function getWorkflowActionForTargetStatus(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus
): TaskWorkflowAction | null {
  for (const [action, transition] of Object.entries(WORKFLOW_TRANSITIONS)) {
    if (
      transition.from.includes(currentStatus) &&
      transition.to === targetStatus
    ) {
      return action as TaskWorkflowAction
    }
  }

  return null
}

export function validateOperationalStepsComplete(
  steps: OperationalStep[],
  stepPhotoCounts: Record<string, number>
): { allowed: boolean; message?: string } {
  for (const step of steps) {
    if (!isOperationalStepComplete(step, stepPhotoCounts)) {
      return {
        allowed: false,
        message: `Falta completar ${step.label}`,
      }
    }
  }

  return { allowed: true }
}

export function validateTaskClosureSubmission(
  task: Task,
  evidenceCount: number
): { allowed: boolean; message?: string } {
  if (getIncompleteChecklistItems(task.checklist).length > 0) {
    return {
      allowed: false,
      message: "Debe completar el checklist antes de solicitar el cierre.",
    }
  }

  if (evidenceCount <= 0) {
    return {
      allowed: false,
      message: "Debe cargar evidencias antes de solicitar el cierre.",
    }
  }

  return { allowed: true }
}

export function validateTaskClosureForSubmit(
  task: Task,
  options?: {
    evidenceCount?: number
    stepPhotoCounts?: Record<string, number>
  }
): { allowed: boolean; message?: string } {
  if (hasOperationalSteps(task)) {
    return validateOperationalStepsComplete(
      task.operationalSteps ?? [],
      options?.stepPhotoCounts ?? {}
    )
  }

  return validateTaskClosureSubmission(task, options?.evidenceCount ?? 0)
}

export function canPerformTaskAction(
  task: Task,
  action: TaskWorkflowAction,
  options?: {
    evidenceCount?: number
    stepPhotoCounts?: Record<string, number>
  }
): { allowed: boolean; message?: string } {
  const { from } = WORKFLOW_TRANSITIONS[action]

  if (!from.includes(task.status)) {
    if (action === "start" && task.status === "vencida") {
      return {
        allowed: false,
        message: TASK_VENCIDA_START_BLOCKED_MESSAGE,
      }
    }

    return {
      allowed: false,
      message: `No se puede ejecutar esta acción desde ${TASK_STATUS_LABELS[task.status]}.`,
    }
  }

  if (action === "reschedule-from-overdue") {
    return { allowed: true }
  }

  if (action === "submit-for-approval") {
    return validateTaskClosureForSubmit(task, options)
  }

  if (action === "reject") {
    return { allowed: true }
  }

  return { allowed: true }
}

export function resolveStatusAfterCrewAssignment(
  currentStatus: TaskStatus,
  crewId: string | null,
  crewName: string,
  options?: { promoteToAssigned?: boolean }
): TaskStatus | null {
  if (!options?.promoteToAssigned) {
    return null
  }

  const hasCrew = Boolean(crewId || crewName.trim())

  if (hasCrew && currentStatus === "programada") {
    return "asignada"
  }

  return null
}

export function getWorkflowHistoryEntry(
  action: TaskWorkflowAction,
  note?: string
): {
  action: string
  description: string
} {
  const { to } = WORKFLOW_TRANSITIONS[action]

  const actionLabels: Record<TaskWorkflowAction, string> = {
    "assign-crew": "Cuadrilla asignada",
    "confirm-planning": "Planificación confirmada",
    "reopen-planning": "Planificación reabierta para edición",
    start: "Trabajo iniciado",
    "submit-for-approval": "Cierre solicitado por operario",
    "report-incident": "Operario reportó incidencia",
    "resume-from-incident": "Orden de trabajo reanudada",
    "reschedule-from-incident": "Orden de trabajo reprogramada",
    "reschedule-from-overdue": "Orden de trabajo reprogramada",
    approve: "Orden de trabajo cerrada",
    reject: "Cierre rechazado",
    close: "Orden de trabajo cerrada",
    cancel: "Orden de trabajo cancelada",
  }

  const description = note?.trim()
    ? note.trim()
    : `Estado cambiado a ${TASK_STATUS_LABELS[to]}.`

  return {
    action: actionLabels[action],
    description,
  }
}
