import type { SessionUser } from "@/lib/auth/types"
import { canAccessObrasModuleForStart } from "@/lib/projects/obra-task-insert-integrity"
import type { Task, TaskStatus } from "@/lib/types/tasks"

/** OT statuses that can be rescheduled from Obra detail (not finalized). */
export const PROJECT_TASK_RESCHEDULE_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "vencida",
  "incidencia",
]

export function canRescheduleProjectTask(
  task: Pick<Task, "projectId" | "status">
): boolean {
  if (!task.projectId) {
    return false
  }

  return PROJECT_TASK_RESCHEDULE_STATUSES.includes(task.status)
}

export function canRescheduleProjectTaskFromSession(
  sessionUser: Pick<
    SessionUser,
    "systemRole" | "roleCode" | "moduleVisibility"
  > | null | undefined,
  task: Pick<Task, "projectId" | "status">
): boolean {
  return (
    canAccessObrasModuleForStart(sessionUser) && canRescheduleProjectTask(task)
  )
}

/**
 * Keep crew and operational assignment.
 * Only lift overdue/incident back into an executable scheduled status.
 */
export function resolveProjectTaskRescheduleTargetStatus(
  task: Pick<Task, "status" | "crewId" | "crew">
): TaskStatus {
  const hasCrew = Boolean(task.crewId?.trim() || task.crew?.trim())

  if (task.status === "vencida" || task.status === "incidencia") {
    return hasCrew ? "asignada" : "programada"
  }

  return task.status
}

export function getProjectTaskRescheduleBlockedMessage(
  task: Pick<Task, "projectId" | "status">
): string | null {
  if (!task.projectId) {
    return "Solo se pueden reprogramar órdenes de trabajo de una obra."
  }

  if (task.status === "finalizada") {
    return "No se puede reprogramar una orden de trabajo finalizada."
  }

  if (task.status === "cancelada") {
    return "No se puede reprogramar una orden de trabajo cancelada."
  }

  if (!canRescheduleProjectTask(task)) {
    return "Esta orden de trabajo no puede reprogramarse en su estado actual."
  }

  return null
}
