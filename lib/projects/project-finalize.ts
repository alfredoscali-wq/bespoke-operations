import type { ProjectStatus } from "@/lib/types/projects"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import { canTransitionProjectStatus } from "@/lib/projects/utils"
import {
  isProjectFinalizeBlockingTaskStatus,
  PROJECT_FINALIZE_BLOCKING_TASK_STATUSES,
} from "@/lib/tasks/status-groups"
import { PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE } from "@/lib/operations/user-messages"

export type ProjectFinalizeTask = Pick<Task, "id" | "status" | "projectId">

export type ProjectFinalizeValidation =
  | { ok: true; openTaskCount: number }
  | { ok: false; message: string }

const FINALIZE_ALLOWED_PROJECT_STATUSES: ProjectStatus[] = ["active", "paused"]

/** Client-side mirror of finalize_project_operational preconditions. */
export function validateFinalizeProject(input: {
  projectStatus: ProjectStatus
  projectId?: string
  tasks: ProjectFinalizeTask[]
}): ProjectFinalizeValidation {
  if (!FINALIZE_ALLOWED_PROJECT_STATUSES.includes(input.projectStatus)) {
    const transition = canTransitionProjectStatus(input.projectStatus, "closed")
    return {
      ok: false,
      message:
        transition.message ??
        "Solo se puede finalizar una obra en estado Activa o Pausada.",
    }
  }

  const openCount = countOpenTasksForProjectFinalize(
    input.tasks,
    input.projectId
  )

  if (openCount > 0) {
    return {
      ok: false,
      message: buildFinalizeBlockedOpenTasksMessage(openCount),
    }
  }

  return { ok: true, openTaskCount: 0 }
}

export function buildFinalizeBlockedOpenTasksMessage(openCount: number): string {
  if (openCount <= 0) {
    return PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE
  }

  const suffix =
    openCount === 1 ? "1 pendiente" : `${openCount} pendientes`

  return `${PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE} (${suffix}).`
}

export function buildFinalizeProjectHistoryDescription(
  previousStatus: ProjectStatus
): string {
  return `Estado actualizado de ${PROJECT_STATUS_LABELS[previousStatus]} a ${PROJECT_STATUS_LABELS.closed}.`
}

export type FinalizeProjectResult = {
  projectId: string
  previousStatus: "active" | "paused"
  nextStatus: "closed"
  openTaskCount: number
}

export function parseFinalizeProjectRpcResult(
  data: unknown
): FinalizeProjectResult | null {
  if (!data || typeof data !== "object") return null

  const row = data as Record<string, unknown>
  const projectId = typeof row.project_id === "string" ? row.project_id : null
  const previousStatus =
    row.previous_status === "active" || row.previous_status === "paused"
      ? row.previous_status
      : null
  const nextStatus = row.next_status === "closed" ? row.next_status : null
  const openTaskCount =
    typeof row.open_task_count === "number" ? row.open_task_count : 0

  if (!projectId || !previousStatus || !nextStatus) return null

  return {
    projectId,
    previousStatus,
    nextStatus,
    openTaskCount,
  }
}

/** Estados que bloquean finalizar obra (espejo de la RPC). */
export { PROJECT_FINALIZE_BLOCKING_TASK_STATUSES }

export function countOpenTasksForProjectFinalize(
  tasks: ProjectFinalizeTask[],
  projectId?: string
): number {
  return tasks.filter((task) => {
    if (!Boolean(task.id) || !Boolean(task.projectId)) {
      return false
    }

    if (projectId && task.projectId !== projectId) {
      return false
    }

    return isProjectFinalizeBlockingTaskStatus(task.status)
  }).length
}

export function isOpenTaskStatusForProjectFinalize(status: string): boolean {
  return isProjectFinalizeBlockingTaskStatus(status)
}
