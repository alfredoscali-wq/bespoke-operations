import {
  PROJECT_PAUSE_REASON_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/projects/constants"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { getTasksForProject } from "@/lib/tasks/utils"
import type { EvidenceRecord } from "@/lib/types/evidence"
import { getActiveEvidence } from "@/lib/evidence/utils"
import type { Crew } from "@/lib/types/crews"
import type {
  PauseProjectInput,
  Project,
  ProjectHistoryEventType,
  ProjectStatus,
} from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import {
  ACTIVE_TASK_STATUSES,
  FINAL_TASK_STATUSES,
} from "@/lib/tasks/status-groups"

export type ProjectOperationalStats = {
  assignedCrews: number
  assignedPersonnel: number
  activeTasks: number
  completedTasks: number
  evidenceFiles: number
  progress: number
}

export function getActiveTasksForProject(
  project: Pick<Project, "id" | "code">,
  tasks: Task[]
): Task[] {
  return getTasksForProject(project as Project, tasks).filter((task) =>
    ACTIVE_TASK_STATUSES.includes(task.status)
  )
}

export function getProjectCrewIds(
  project: Pick<Project, "id" | "code">,
  tasks: Task[],
  crews: Pick<Crew, "id" | "name">[] = []
): string[] {
  const crewIds = new Set<string>()

  for (const task of getActiveTasksForProject(project, tasks)) {
    const crewId = resolveTaskCrewId(task, crews)
    if (crewId && crews.some((crew) => crew.id === crewId)) {
      crewIds.add(crewId)
    }
  }

  return [...crewIds]
}

export function getProjectCrews(
  project: Pick<Project, "id" | "code">,
  tasks: Task[],
  crews: Crew[]
): Crew[] {
  const crewIds = new Set(getProjectCrewIds(project, tasks, crews))
  return crews.filter((crew) => crewIds.has(crew.id))
}

export function getProjectAssignedPersonnelCount(
  project: Pick<Project, "id" | "code">,
  tasks: Task[],
  crews: Crew[]
): number {
  const projectCrews = getProjectCrews(project, tasks, crews)
  const personnelKeys = new Set<string>()

  for (const crew of projectCrews) {
    for (const member of crew.members) {
      if (!member.active) continue

      personnelKeys.add(member.employeeId ?? `member:${member.id}`)
    }
  }

  return personnelKeys.size
}

export function getProjectOperationalStats(
  project: Pick<Project, "id" | "code" | "progress">,
  tasks: Task[],
  evidence: EvidenceRecord[],
  crews: Crew[] = []
): ProjectOperationalStats {
  const projectTasks = getTasksForProject(project as Project, tasks)
  const projectEvidence = getActiveEvidence(evidence).filter(
    (item) =>
      item.projectId === project.id || item.projectCode === project.code
  )

  return {
    assignedCrews: getProjectCrewIds(project, tasks, crews).length,
    assignedPersonnel: getProjectAssignedPersonnelCount(project, tasks, crews),
    activeTasks: projectTasks.filter((task) =>
      ACTIVE_TASK_STATUSES.includes(task.status)
    ).length,
    completedTasks: projectTasks.filter((task) =>
      FINAL_TASK_STATUSES.includes(task.status)
    ).length,
    evidenceFiles: projectEvidence.length,
    progress: project.progress,
  }
}

const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  planned: ["active", "cancelled"],
  active: ["paused", "closed", "cancelled"],
  paused: ["active", "closed", "cancelled"],
  "pending-closure": ["closed", "active"],
  closed: ["active"],
  cancelled: [],
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

export type ProjectActionId =
  | "edit"
  | "start"
  | "pause"
  | "resume"
  | "finalize"
  | "archive"
  | "reopen"
  | "view_planning"

export type ProjectAction = {
  id: ProjectActionId
  label: string
  variant?: "default" | "destructive" | "outline"
}

export function getProjectActions(status: ProjectStatus): ProjectAction[] {
  switch (status) {
    case "active":
      return [
        { id: "edit", label: "Editar obra", variant: "outline" },
        { id: "pause", label: "Pausar obra", variant: "outline" },
        { id: "finalize", label: "Finalizar obra" },
        { id: "archive", label: "Archivar obra", variant: "destructive" },
        { id: "view_planning", label: "Ver planificación", variant: "outline" },
      ]
    case "paused":
      return [
        { id: "edit", label: "Editar obra", variant: "outline" },
        { id: "resume", label: "Reanudar obra" },
        { id: "finalize", label: "Finalizar obra", variant: "outline" },
        { id: "archive", label: "Archivar obra", variant: "destructive" },
        { id: "view_planning", label: "Ver planificación", variant: "outline" },
      ]
    case "planned":
      return [
        { id: "edit", label: "Editar obra", variant: "outline" },
        { id: "start", label: "Iniciar obra" },
        { id: "archive", label: "Archivar obra", variant: "destructive" },
      ]
    case "closed":
      return [
        { id: "reopen", label: "Reabrir obra", variant: "outline" },
        { id: "view_planning", label: "Ver planificación", variant: "outline" },
      ]
    case "cancelled":
      return [{ id: "view_planning", label: "Ver planificación", variant: "outline" }]
    default:
      return [
        { id: "edit", label: "Editar obra", variant: "outline" },
        { id: "view_planning", label: "Ver planificación", variant: "outline" },
      ]
  }
}

export function buildPauseHistoryDescription(input: PauseProjectInput): string {
  const reason = PROJECT_PAUSE_REASON_LABELS[input.reason]
  if (input.notes?.trim()) {
    return `${reason}. ${input.notes.trim()}`
  }
  return reason
}

export function getHistoryTitleForEvent(
  eventType: ProjectHistoryEventType
): string {
  const titles: Record<ProjectHistoryEventType, string> = {
    created: "Obra creada",
    updated: "Obra editada",
    status_changed: "Cambio de estado",
    paused: "Obra pausada",
    resumed: "Obra reanudada",
    finalized: "Obra finalizada",
    archived: "Obra archivada",
    reopened: "Obra reabierta",
    cancelled: "Obra cancelada",
  }

  return titles[eventType]
}
