import { compareDateOnly } from "@/lib/dates/date-only"
import { extractDatePortion, toDateOnlyString } from "@/lib/reports/report-utils"
import { getTasksForProject } from "@/lib/tasks/utils"
import { isTaskVencida } from "@/lib/tasks/vencida-status"
import type { Project } from "@/lib/types/projects"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export type ProjectHealth = "healthy" | "risk" | "overdue"

export interface ProjectOperationalMetrics {
  progress: number
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  health: ProjectHealth
}

export type ProjectHealthVariant = "success" | "warning" | "danger"

const ACTIVE_TASK_STATUSES = [
  "programada",
  "asignada",
  "vencida",
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
] as const

const COMPLETED_TASK_STATUSES = ["finalizada", "cerrada"] as const

const CANCELLED_TASK_STATUSES = ["cancelada"] as const

const ACTIVE_TASK_STATUS_SET = new Set<TaskStatus>(ACTIVE_TASK_STATUSES)
const COMPLETED_TASK_STATUS_SET = new Set<TaskStatus>(COMPLETED_TASK_STATUSES)
const CANCELLED_TASK_STATUS_SET = new Set<TaskStatus>(CANCELLED_TASK_STATUSES)

function isPendingTaskStatus(status: TaskStatus): boolean {
  return ACTIVE_TASK_STATUS_SET.has(status)
}

function isCompletedTaskStatus(status: TaskStatus): boolean {
  return COMPLETED_TASK_STATUS_SET.has(status)
}

function isCancelledTaskStatus(status: TaskStatus): boolean {
  return CANCELLED_TASK_STATUS_SET.has(status)
}

function isTaskOverdue(task: Task): boolean {
  return isTaskVencida(task)
}

function calculateProjectHealth(
  project: Project,
  progress: number,
  referenceDate = new Date()
): ProjectHealth {
  const today = toDateOnlyString(referenceDate)
  const targetEndDate = extractDatePortion(project.endDate)

  if (
    targetEndDate &&
    project.status !== "closed" &&
    project.status !== "cancelled" &&
    compareDateOnly(targetEndDate, today) < 0
  ) {
    return "overdue"
  }

  if (targetEndDate && project.status !== "closed" && project.status !== "cancelled") {
    const daysRemaining = compareDateOnly(targetEndDate, today)

    if (daysRemaining >= 0 && daysRemaining <= 7 && progress < 80) {
      return "risk"
    }
  }

  return "healthy"
}

function calculateMetricsFromProjectTasks(
  project: Project,
  projectTasks: Task[],
  referenceDate = new Date()
): ProjectOperationalMetrics {
  const today = toDateOnlyString(referenceDate)
  let totalTasks = 0
  let completedTasks = 0
  let pendingTasks = 0
  let overdueTasks = 0

  for (const task of projectTasks) {
    if (isCancelledTaskStatus(task.status)) {
      continue
    }

    totalTasks += 1

    if (isCompletedTaskStatus(task.status)) {
      completedTasks += 1
    }

    if (isPendingTaskStatus(task.status)) {
      pendingTasks += 1
    }

    if (isTaskOverdue(task)) {
      overdueTasks += 1
    }
  }

  const progress =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  return {
    progress,
    totalTasks,
    completedTasks,
    pendingTasks,
    overdueTasks,
    health: calculateProjectHealth(project, progress, referenceDate),
  }
}

export type ProjectTasksIndex = {
  byProjectId: Map<string, Task[]>
  byProjectCode: Map<string, Task[]>
}

export function buildProjectTasksIndex(tasks: Task[]): ProjectTasksIndex {
  const byProjectId = new Map<string, Task[]>()
  const byProjectCode = new Map<string, Task[]>()

  for (const task of tasks) {
    if (task.projectId) {
      const projectTasks = byProjectId.get(task.projectId) ?? []
      projectTasks.push(task)
      byProjectId.set(task.projectId, projectTasks)
      continue
    }

    if (task.projectCode) {
      const projectTasks = byProjectCode.get(task.projectCode) ?? []
      projectTasks.push(task)
      byProjectCode.set(task.projectCode, projectTasks)
    }
  }

  return { byProjectId, byProjectCode }
}

export function getProjectTasksFromIndex(
  project: Pick<Project, "id" | "code">,
  index: ProjectTasksIndex
): Task[] {
  const tasksById = index.byProjectId.get(project.id) ?? []

  if (tasksById.length > 0) {
    return tasksById
  }

  return index.byProjectCode.get(project.code) ?? []
}

export function buildProjectOperationalMetricsMap(
  projects: Project[],
  tasks: Task[],
  referenceDate = new Date()
): Map<string, ProjectOperationalMetrics> {
  const index = buildProjectTasksIndex(tasks)
  const metrics = new Map<string, ProjectOperationalMetrics>()

  for (const project of projects) {
    metrics.set(
      project.id,
      calculateMetricsFromProjectTasks(
        project,
        getProjectTasksFromIndex(project, index),
        referenceDate
      )
    )
  }

  return metrics
}

export function calculateProjectOperationalMetrics(
  project: Project,
  tasks: Task[]
): ProjectOperationalMetrics {
  return calculateMetricsFromProjectTasks(project, getTasksForProject(project, tasks))
}

export function getProjectHealthLabel(health: ProjectHealth): string {
  switch (health) {
    case "healthy":
      return "En plazo"
    case "risk":
      return "Riesgo"
    case "overdue":
      return "Vencida"
  }
}

export function getProjectHealthVariant(
  health: ProjectHealth
): ProjectHealthVariant {
  switch (health) {
    case "healthy":
      return "success"
    case "risk":
      return "warning"
    case "overdue":
      return "danger"
  }
}
