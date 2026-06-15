import type {
  Crew,
  CrewDetail,
  CrewFilters,
  CrewListItem,
  CrewSummary,
} from "@/lib/types/crews"
import type { EvidenceRecord } from "@/lib/types/evidence"
import { getActiveEvidence } from "@/lib/evidence/utils"
import type { Project, ProjectStatus } from "@/lib/types/projects"
import type { Task, TaskStatus } from "@/lib/types/tasks"

const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "en-aprobacion",
]

const COMPLETED_TASK_STATUSES: TaskStatus[] = ["finalizada", "cerrada"]

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["active", "pending-closure"]

export const defaultCrewFilters: CrewFilters = {
  search: "",
  status: "all",
  supervisor: "all",
}

export function getCrewById(id: string, crews: Crew[]): Crew | undefined {
  return crews.find((crew) => crew.id === id)
}

export function getCrewByName(name: string, crews: Crew[]): Crew | undefined {
  return crews.find((crew) => crew.name === name)
}

/** Legacy helper for modules not yet migrated to CrewsProvider */
export function getCrewIdByName(_name: string): string | undefined {
  return undefined
}

export function taskMatchesCrew(
  task: Task,
  crew: Pick<Crew, "id" | "name">
): boolean {
  return task.crewId === crew.id || task.crew === crew.name
}

export function getCrewTasks(
  crew: Pick<Crew, "id" | "name">,
  tasks: Task[]
): Task[] {
  return tasks.filter((task) => taskMatchesCrew(task, crew))
}

export function getCrewActiveTasks(
  crew: Pick<Crew, "id" | "name">,
  tasks: Task[]
): Task[] {
  return getCrewTasks(crew, tasks).filter((task) =>
    ACTIVE_TASK_STATUSES.includes(task.status)
  )
}

export function getCrewProjects(
  crew: Pick<Crew, "id" | "name">,
  tasks: Task[],
  projects: Project[]
): Project[] {
  const projectCodes = new Set(
    getCrewTasks(crew, tasks).map((task) => task.projectCode)
  )

  return projects.filter(
    (project) =>
      projectCodes.has(project.code) &&
      ACTIVE_PROJECT_STATUSES.includes(project.status)
  )
}

export function buildCrewListItem(
  crew: Crew,
  tasks: Task[],
  projects: Project[]
): CrewListItem {
  return {
    ...crew,
    activeTasks: getCrewActiveTasks(crew, tasks).length,
    activeProjects: getCrewProjects(crew, tasks, projects).length,
    memberCount: crew.members.filter((member) => member.active).length,
  }
}

export function getCrewListItems(
  crews: Crew[],
  tasks: Task[],
  projects: Project[]
): CrewListItem[] {
  return crews.map((crew) => buildCrewListItem(crew, tasks, projects))
}

export function getCrewsSummary(
  crews: Crew[],
  tasks: Task[],
  projects: Project[]
): CrewSummary {
  const activeCrews = crews.filter((crew) => crew.status === "activa").length

  const assignedTasks = tasks.filter(
    (task) =>
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      crews.some((crew) => taskMatchesCrew(task, crew))
  ).length

  const activeProjectCodes = new Set<string>()
  tasks.forEach((task) => {
    if (
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      crews.some((crew) => taskMatchesCrew(task, crew))
    ) {
      activeProjectCodes.add(task.projectCode)
    }
  })

  const activeProjects = projects.filter(
    (project) =>
      activeProjectCodes.has(project.code) &&
      ACTIVE_PROJECT_STATUSES.includes(project.status)
  ).length

  return {
    totalCrews: crews.length,
    activeCrews,
    assignedTasks,
    activeProjects,
  }
}

export function getSupervisorOptions(crews: Crew[]): string[] {
  return Array.from(new Set(crews.map((crew) => crew.supervisor))).sort()
}

export function filterCrews(
  crews: CrewListItem[],
  filters: CrewFilters
): CrewListItem[] {
  const query = filters.search.trim().toLowerCase()

  return crews.filter((crew) => {
    const matchesSearch =
      query === "" ||
      crew.name.toLowerCase().includes(query) ||
      crew.description.toLowerCase().includes(query) ||
      crew.supervisor.toLowerCase().includes(query) ||
      crew.notes.toLowerCase().includes(query) ||
      crew.members.some(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.role.toLowerCase().includes(query)
      )

    const matchesStatus =
      filters.status === "all" || crew.status === filters.status

    const matchesSupervisor =
      filters.supervisor === "all" || crew.supervisor === filters.supervisor

    return matchesSearch && matchesStatus && matchesSupervisor
  })
}

export function getCrewDetail(
  crew: Crew,
  tasks: Task[],
  projects: Project[],
  evidence: EvidenceRecord[] = []
): CrewDetail {
  const crewTasks = getCrewTasks(crew, tasks)
  const completedTasks = crewTasks.filter((task) =>
    COMPLETED_TASK_STATUSES.includes(task.status)
  ).length

  return {
    activity: [],
    performance: {
      completedTasks,
      averageCompletionDays: 0,
      approvedEvidence: getActiveEvidence(evidence).filter(
        (item) => item.crew === crew.name
      ).length,
      productivityScore: 0,
    },
    stats: {
      activeTasks: getCrewActiveTasks(crew, tasks).length,
      activeProjects: getCrewProjects(crew, tasks, projects).length,
      completedTasks,
      membersAvailable: crew.members.filter((member) => member.active).length,
    },
  }
}
