import type {
  Crew,
  CrewDetail,
  CrewFilters,
  CrewListItem,
  CrewMember,
  CrewSummary,
} from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import { getEmployeeFullName } from "@/lib/employees/utils"
import { resolveCrewSupervisorDisplay } from "@/lib/crews/supervisor"
import type { EvidenceRecord } from "@/lib/types/evidence"
import { getActiveEvidence } from "@/lib/evidence/utils"
import type { Project, ProjectStatus } from "@/lib/types/projects"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import {
  ACTIVE_TASK_STATUSES,
  FINAL_TASK_STATUSES,
} from "@/lib/tasks/status-groups"

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["active", "pending-closure"]

export const defaultCrewFilters: CrewFilters = {
  search: "",
  status: "all",
  supervisor: "all",
}

export type CrewMemberDisplay = {
  employeeCode: string | null
  fullName: string
  isLegacy: boolean
}

export function resolveCrewMemberDisplay(
  member: CrewMember,
  getEmployee?: (id: string) => Employee | undefined
): CrewMemberDisplay {
  if (member.employeeId && getEmployee) {
    const employee = getEmployee(member.employeeId)
    if (employee) {
      return {
        employeeCode: employee.employeeCode,
        fullName: getEmployeeFullName(employee),
        isLegacy: false,
      }
    }
  }

  return {
    employeeCode: null,
    fullName: member.name,
    isLegacy: true,
  }
}

export function getAssignedEmployeeIds(
  members: CrewMember[],
  excludeMemberId?: string
): string[] {
  return members
    .filter(
      (member) =>
        member.employeeId &&
        member.id !== excludeMemberId
    )
    .map((member) => member.employeeId!)
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
  if (task.crewId) {
    return task.crewId === crew.id
  }

  return Boolean(task.crew?.trim() && task.crew === crew.name)
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

export function getSupervisorOptions(
  crews: Crew[],
  getEmployee?: (id: string) => Employee | undefined
): string[] {
  return Array.from(
    new Set(
      crews.map(
        (crew) => resolveCrewSupervisorDisplay(crew, getEmployee).displayName
      )
    )
  ).sort((a, b) => a.localeCompare(b, "es"))
}

export function filterCrews(
  crews: CrewListItem[],
  filters: CrewFilters,
  getEmployee?: (id: string) => Employee | undefined
): CrewListItem[] {
  const query = filters.search.trim().toLowerCase()

  return crews.filter((crew) => {
    const supervisorDisplay = resolveCrewSupervisorDisplay(
      crew,
      getEmployee
    ).displayName

    const matchesSearch =
      query === "" ||
      crew.name.toLowerCase().includes(query) ||
      crew.description.toLowerCase().includes(query) ||
      supervisorDisplay.toLowerCase().includes(query) ||
      crew.notes.toLowerCase().includes(query) ||
      crew.members.some(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.role.toLowerCase().includes(query)
      )

    const matchesStatus =
      filters.status === "all" || crew.status === filters.status

    const matchesSupervisor =
      filters.supervisor === "all" ||
      supervisorDisplay === filters.supervisor

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
    FINAL_TASK_STATUSES.includes(task.status)
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
