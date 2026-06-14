export type CrewStatus = "activa" | "inactiva" | "en-campo"

export type CrewMember = {
  id: string
  crewId: string
  name: string
  role: string
  phone?: string
  active: boolean
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
  description: string
  supervisor: string
  status: CrewStatus
  notes: string
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
  supervisor: string | "all"
}

export type NewCrewInput = {
  name: string
  description: string
  supervisor: string
  status: CrewStatus
  notes: string
}

export type NewCrewMemberInput = {
  name: string
  role: string
  phone?: string
  active: boolean
}
