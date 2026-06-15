import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import { getTasksForProject } from "@/lib/tasks/utils"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type { Project, ProjectStatus } from "@/lib/types/projects"
import type { Task, TaskStatus } from "@/lib/types/tasks"

const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "en-aprobacion",
]

const COMPLETED_TASK_STATUSES: TaskStatus[] = ["finalizada", "cerrada"]

export type ProjectOperationalStats = {
  activeTasks: number
  completedTasks: number
  evidenceFiles: number
  progress: number
}

export function getProjectOperationalStats(
  project: Pick<Project, "id" | "code" | "progress">,
  tasks: Task[],
  evidence: EvidenceRecord[]
): ProjectOperationalStats {
  const projectTasks = getTasksForProject(project as Project, tasks)
  const projectEvidence = evidence.filter(
    (item) =>
      item.projectId === project.id || item.projectCode === project.code
  )

  return {
    activeTasks: projectTasks.filter((task) =>
      ACTIVE_TASK_STATUSES.includes(task.status)
    ).length,
    completedTasks: projectTasks.filter((task) =>
      COMPLETED_TASK_STATUSES.includes(task.status)
    ).length,
    evidenceFiles: projectEvidence.length,
    progress: project.progress,
  }
}

const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  planned: ["active"],
  active: ["pending-closure"],
  paused: [],
  "pending-closure": ["closed"],
  closed: [],
}

export function canTransitionProjectStatus(
  currentStatus: ProjectStatus,
  newStatus: ProjectStatus
): { allowed: boolean; message?: string } {
  if (currentStatus === newStatus) {
    return {
      allowed: false,
      message: "La obra ya está en ese estado.",
    }
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? []

  if (!allowedNext.includes(newStatus)) {
    return {
      allowed: false,
      message: `No se puede cambiar de ${PROJECT_STATUS_LABELS[currentStatus]} a ${PROJECT_STATUS_LABELS[newStatus]}.`,
    }
  }

  return { allowed: true }
}

export function getProjectLifecycleAction(
  currentStatus: ProjectStatus
): { label: string; nextStatus: ProjectStatus } | null {
  switch (currentStatus) {
    case "planned":
      return { label: "Iniciar Obra", nextStatus: "active" }
    case "active":
      return { label: "Solicitar Cierre", nextStatus: "pending-closure" }
    case "pending-closure":
      return { label: "Cerrar Obra", nextStatus: "closed" }
    default:
      return null
  }
}
