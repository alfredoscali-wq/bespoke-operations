import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import type { ChecklistItem, OperationalStep, Task, TaskStatus } from "@/lib/types/tasks"

export type TaskWorkflowAction =
  | "assign-crew"
  | "start"
  | "submit-for-approval"
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
  "assign-crew": { from: ["pendiente"], to: "asignada" },
  start: { from: ["asignada"], to: "en-curso" },
  "submit-for-approval": { from: ["en-curso"], to: "pendiente-cierre" },
  approve: { from: PENDING_CLOSURE_STATUSES, to: "cerrada" },
  reject: { from: PENDING_CLOSURE_STATUSES, to: "en-curso" },
  close: { from: ["finalizada"], to: "cerrada" },
  cancel: {
    from: [
      "pendiente",
      "asignada",
      "en-curso",
      "pendiente-cierre",
      "en-aprobacion",
    ],
    to: "cancelada",
  },
}

export function getInitialTaskStatus(input: {
  crewId?: string | null
  crew?: string
}): TaskStatus {
  const hasCrew = Boolean(input.crewId || input.crew?.trim())
  return hasCrew ? "asignada" : "pendiente"
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
    if ((stepPhotoCounts[step.id] ?? 0) <= 0) {
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
      message: "Debe completar el checklist antes de finalizar la tarea.",
    }
  }

  if (evidenceCount <= 0) {
    return {
      allowed: false,
      message: "Debe cargar evidencias antes de finalizar la tarea.",
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
    return {
      allowed: false,
      message: `No se puede ejecutar esta acción desde ${TASK_STATUS_LABELS[task.status]}.`,
    }
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
  crewName: string
): TaskStatus | null {
  const hasCrew = Boolean(crewId || crewName.trim())

  if (hasCrew && currentStatus === "pendiente") {
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
    start: "Trabajo iniciado",
    "submit-for-approval": "Enviado a validación de cierre",
    approve: "Cierre aprobado",
    reject: "Cierre rechazado",
    close: "Tarea cerrada",
    cancel: "Tarea cancelada",
  }

  const description = note?.trim()
    ? note.trim()
    : `Estado cambiado a ${TASK_STATUS_LABELS[to]}.`

  return {
    action: actionLabels[action],
    description,
  }
}
