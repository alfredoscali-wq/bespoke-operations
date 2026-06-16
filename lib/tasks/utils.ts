import type { ChecklistItem, Task, TaskStatus } from "@/lib/types/tasks"
import type { Crew } from "@/lib/types/crews"
import type { Project } from "@/lib/types/projects"
import {
  canPerformTaskAction,
  getWorkflowActionForTargetStatus,
} from "@/lib/tasks/task-status-workflow"

export function getChecklistProgress(checklist: ChecklistItem[]): number {
  if (checklist.length === 0) return 0
  const completed = checklist.filter((item) => item.completed).length
  return Math.round((completed / checklist.length) * 100)
}

export function getRequiredChecklistComplete(checklist: ChecklistItem[]): boolean {
  return checklist.filter((item) => item.required).every((item) => item.completed)
}

export function getIncompleteRequiredItems(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => item.required && !item.completed)
}

export function canMoveToStatus(
  task: Task,
  newStatus: TaskStatus
): { allowed: boolean; message?: string } {
  const action = getWorkflowActionForTargetStatus(task.status, newStatus)
  if (!action) {
    return { allowed: false, message: "Transición no permitida." }
  }

  return canPerformTaskAction(task, action)
}

export function syncTaskProgress(task: Task): Task {
  const progress = getChecklistProgress(task.checklist)
  return { ...task, progress }
}

export function getTasksForProject(project: Project, tasks: Task[]): Task[] {
  return tasks.filter(
    (task) =>
      task.projectId === project.id ||
      (!task.projectId && task.projectCode === project.code)
  )
}

export function isFieldServiceTask(task: Pick<Task, "projectId">): boolean {
  return !task.projectId
}

export function resolveSupervisorFromCrew(
  crew: Pick<Crew, "supervisor"> | null | undefined
): string {
  return crew?.supervisor.trim() ?? ""
}

/**
 * Derives task supervisor from crew selection.
 * Preserves existing supervisor when the crew is unchanged (edit compatibility).
 */
export function resolveTaskSupervisorForCrewChange(
  crewId: string | null | undefined,
  crews: Pick<Crew, "id" | "name" | "supervisor">[],
  previousCrewId?: string | null,
  existingSupervisor?: string
): string {
  if (!crewId) {
    return ""
  }

  const crew = crews.find((item) => item.id === crewId)
  if (!crew) {
    return existingSupervisor ?? ""
  }

  if (
    previousCrewId !== undefined &&
    previousCrewId === crewId &&
    existingSupervisor !== undefined
  ) {
    return existingSupervisor
  }

  return resolveSupervisorFromCrew(crew)
}

export function generateFieldServiceTaskCode(tasks: Task[]): string {
  const prefix = "TSK-SRV-"
  const serviceTasks = tasks.filter((task) => isFieldServiceTask(task))
  let counter = serviceTasks.length + 1
  let code = `${prefix}${String(counter).padStart(3, "0")}`

  while (tasks.some((task) => task.code === code)) {
    counter += 1
    code = `${prefix}${String(counter).padStart(3, "0")}`
  }

  return code
}

export function generateTaskCode(projectCode: string, tasks: Task[]): string {
  const sanitized = projectCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  const prefix = `TSK-${sanitized}-`
  const projectTasks = tasks.filter((task) => task.projectCode === projectCode)
  let counter = projectTasks.length + 1
  let code = `${prefix}${String(counter).padStart(3, "0")}`

  while (tasks.some((task) => task.code === code)) {
    counter += 1
    code = `${prefix}${String(counter).padStart(3, "0")}`
  }

  return code
}
