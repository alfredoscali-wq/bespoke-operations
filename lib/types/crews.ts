export type CrewStatus = "disponible" | "en-campo" | "fuera-de-servicio"

export type MemberStatus = "disponible" | "en-campo" | "fuera-de-servicio"

export type CrewMember = {
  id: string
  name: string
  position: string
  status: MemberStatus
}

export type CrewActivityType =
  | "task-assigned"
  | "work-started"
  | "evidence-uploaded"
  | "task-completed"
  | "project-completed"

export type CrewActivityEvent = {
  id: string
  type: CrewActivityType
  title: string
  description: string
  timestamp: string
  projectCode?: string
  taskCode?: string
}

export type CrewPerformance = {
  completedTasks: number
  averageCompletionDays: number
  approvedEvidence: number
  productivityScore: number
}

export type Crew = {
  id: string
  name: string
  specialty: string
  supervisor: string
  vehicle: string
  status: CrewStatus
  members: CrewMember[]
}

export type CrewListItem = Crew & {
  activeTasks: number
  activeProjects: number
  memberCount: number
}

export type CrewDetail = {
  activity: CrewActivityEvent[]
  performance: CrewPerformance
  stats: {
    activeTasks: number
    activeProjects: number
    completedTasks: number
    membersAvailable: number
  }
}

export type CrewSummary = {
  totalCrews: number
  activeCrews: number
  assignedTasks: number
  activeProjects: number
}

export type CrewFilters = {
  search: string
  status: CrewStatus | "all"
  specialty: string | "all"
}
