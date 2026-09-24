import { isActiveTaskStatus } from "@/lib/tasks/status-groups"
import { matchesProjectWorkOrderListQuery } from "@/lib/tasks/task-list-scope"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import type { Task, TaskStatus } from "@/lib/types/tasks"

import { isProjectWorkReportDeploymentTask } from "@/lib/projects/work-report/deployment"
import type {
  ProjectWorkReportOptions,
  ProjectWorkReportTaskScope,
} from "@/lib/projects/work-report/options"

export type ProjectWorkReportTaskRow = Pick<
  Task,
  "id" | "code" | "status" | "dueDate" | "projectId" | "title"
> & {
  type?: Task["type"] | string | null
  companyId?: string | null
  deletedAt?: string | null
}

/**
 * Client-report "finalizadas": trabajo ejecutado y cerrado.
 * Excludes activas, pendiente-cierre and cancelada.
 * Includes legacy `cerrada` (normalized to finalizada at runtime).
 */
export function isProjectWorkReportCompletedStatus(
  status: TaskStatus | string | undefined
): boolean {
  return status === "finalizada" || status === "cerrada"
}

export function matchesProjectWorkReportTask(
  task: ProjectWorkReportTaskRow,
  companyId: string,
  projectId: string,
  scope: ProjectWorkReportTaskScope,
  selectedTaskIds: string[] = []
): boolean {
  if (!matchesProjectWorkOrderListQuery(task, companyId, projectId)) {
    return false
  }

  const isDeployment = isProjectWorkReportDeploymentTask(task)

  if (scope === "selected") {
    return selectedTaskIds.includes(task.id)
  }

  if (isDeployment) {
    return false
  }

  if (scope === "completed") {
    return isProjectWorkReportCompletedStatus(task.status)
  }

  return true
}

export function compareProjectWorkReportTasks(
  left: Pick<ProjectWorkReportTaskRow, "id" | "code" | "dueDate">,
  right: Pick<ProjectWorkReportTaskRow, "id" | "code" | "dueDate">
): number {
  return (
    (left.dueDate ?? "").localeCompare(right.dueDate ?? "") ||
    (left.code ?? "").localeCompare(right.code ?? "") ||
    (left.id ?? "").localeCompare(right.id ?? "")
  )
}

export function selectProjectWorkReportTasks<T extends ProjectWorkReportTaskRow>(
  tasks: T[],
  companyId: string,
  projectId: string,
  scope: ProjectWorkReportTaskScope,
  selectedTaskIds: string[] = []
): T[] {
  return tasks
    .filter((task) =>
      matchesProjectWorkReportTask(
        task,
        companyId,
        projectId,
        scope,
        selectedTaskIds
      )
    )
    .sort(compareProjectWorkReportTasks)
}

export function filterProjectWorkReportTasksByScope<
  T extends Pick<Task, "id" | "status" | "title"> & {
    type?: Task["type"] | string | null
  },
>(tasks: T[], scope: ProjectWorkReportTaskScope, selectedTaskIds: string[] = []): T[] {
  if (scope === "selected") {
    const allowed = new Set(selectedTaskIds)
    return tasks.filter((task) => allowed.has(task.id))
  }

  return tasks.filter((task) => {
    if (isProjectWorkReportDeploymentTask(task)) {
      return false
    }
    if (scope === "all") {
      return true
    }
    return isProjectWorkReportCompletedStatus(task.status)
  })
}

export function defaultProjectWorkReportSelectedTaskIds<
  T extends Pick<Task, "id" | "title"> & { type?: Task["type"] | string | null },
>(tasks: T[]): string[] {
  return tasks
    .filter((task) => !isProjectWorkReportDeploymentTask(task))
    .map((task) => task.id)
}

export function summarizeProjectWorkReportTasks(
  tasks: Array<Pick<Task, "status" | "crew">>
): {
  includedCount: number
  completedCount: number
  activeCount: number
  pendingClosureCount: number
  crews: string[]
} {
  const crews = new Set<string>()

  for (const task of tasks) {
    const crew = task.crew?.trim()
    if (crew) {
      crews.add(crew)
    }
  }

  return {
    includedCount: tasks.length,
    completedCount: tasks.filter((task) =>
      isProjectWorkReportCompletedStatus(task.status)
    ).length,
    activeCount: tasks.filter((task) => isActiveTaskStatus(task.status)).length,
    pendingClosureCount: tasks.filter((task) =>
      isPendingClosureStatus(task.status)
    ).length,
    crews: [...crews].sort((left, right) => left.localeCompare(right, "es")),
  }
}

export function resolveProjectWorkReportLoadOptions(
  options: ProjectWorkReportOptions
): ProjectWorkReportOptions {
  return {
    taskScope: options.taskScope,
    selectedTaskIds:
      options.taskScope === "selected" ? options.selectedTaskIds : [],
  }
}
