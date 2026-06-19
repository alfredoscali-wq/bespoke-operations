import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import type { ChecklistItem, Task, TaskStatus } from "@/lib/types/tasks"

export type TaskWorkflowAction =
  | "assign-crew"
  | "start"
  | "submit-for-approval"
  | "approve"
  | "reject"
  | "close"
  | "cancel"

function getRequiredChecklistComplete(checklist: ChecklistItem[]): boolean {
  return checklist
    .filter((item) => item.required)
    .every((item) => item.completed)
}

function getIncompleteRequiredItems(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => item.required && !item.completed)
}

const WORKFLOW_TRANSITIONS: Record<
  TaskWorkflowAction,
  { from: TaskStatus[]; to: TaskStatus }
> = {
  "assign-crew": { from: ["pendiente"], to: "asignada" },
  start: { from: ["asignada"], to: "en-curso" },
  "submit-for-approval": { from: ["en-curso"], to: "en-aprobacion" },
  approve: { from: ["en-aprobacion"], to: "finalizada" },
  reject: { from: ["en-aprobacion"], to: "en-curso" },
  close: { from: ["finalizada"], to: "cerrada" },
  cancel: {
    from: ["pendiente", "asignada", "en-curso", "en-aprobacion"],
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

export function canPerformTaskAction(
  task: Task,
  action: TaskWorkflowAction
): { allowed: boolean; message?: string } {
  const { from } = WORKFLOW_TRANSITIONS[action]

  if (!from.includes(task.status)) {
    return {
      allowed: false,
      message: `No se puede ejecutar esta acción desde ${TASK_STATUS_LABELS[task.status]}.`,
    }
  }

  if (
    action === "submit-for-approval" &&
    !getRequiredChecklistComplete(task.checklist)
  ) {
    const missing = getIncompleteRequiredItems(task.checklist)
      .map((item) => item.label)
      .join(", ")

    return {
      allowed: false,
      message: `Complete los elementos obligatorios antes de finalizar: ${missing}.`,
    }
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

export function getWorkflowHistoryEntry(action: TaskWorkflowAction): {
  action: string
  description: string
} {
  const { to } = WORKFLOW_TRANSITIONS[action]

  const actionLabels: Record<TaskWorkflowAction, string> = {
    "assign-crew": "Cuadrilla asignada",
    start: "Trabajo iniciado",
    "submit-for-approval": "Enviado a aprobación",
    approve: "Tarea aprobada",
    reject: "Tarea rechazada",
    close: "Tarea cerrada",
    cancel: "Tarea cancelada",
  }

  return {
    action: actionLabels[action],
    description: `Estado cambiado a ${TASK_STATUS_LABELS[to]}.`,
  }
}
