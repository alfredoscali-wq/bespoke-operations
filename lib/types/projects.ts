export type ProjectStatus =
  | "planned"
  | "active"
  | "paused"
  | "pending-closure"
  | "closed"
  | "cancelled"

export type ProjectPauseReason =
  | "climatic"
  | "materials"
  | "client"
  | "permits"
  | "resources"
  | "safety"
  | "other"

export type ProjectType =
  | "fiber"
  | "camera"
  | "wireless"
  | "pole"
  | "maintenance"

export type ProjectHistoryEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "paused"
  | "resumed"
  | "finalized"
  | "archived"
  | "reopened"
  | "cancelled"

export type Project = {
  id: string
  code: string
  name: string
  client: string
  type: ProjectType
  status: ProjectStatus
  progress: number
  startDate?: string
  endDate?: string
  supervisor: string
  location: string
  /** GPS operativo único de la Obra (OBRAS OPS 1.1). */
  latitude?: number | null
  longitude?: number | null
  description: string
  pauseReason?: ProjectPauseReason
  pauseNotes?: string
  pausedAt?: string
  createdAt?: string
}

export type ProjectTask = {
  id: string
  title: string
  assignee: string
  dueDate: string
  priority: "alta" | "media" | "baja"
  status: "pendiente" | "en-curso" | "completada"
}

export type ProjectEvidence = {
  id: string
  title: string
  type: "photo" | "file"
  uploadedBy: string
  uploadedAt: string
  category: string
}

export type ProjectDocument = {
  id: string
  name: string
  type: "pdf" | "plan" | "certificate"
  size: string
  uploadedAt: string
}

export type ProjectHistoryEvent = {
  id: string
  eventType: ProjectHistoryEventType
  title: string
  description: string
  user: string
  timestamp: string
  metadata?: Record<string, string>
}

export type ProjectCosts = {
  materials: number
  labor: number
  equipment: number
  vehicles: number
}

export type ProjectDetail = {
  tasks: ProjectTask[]
  evidence: ProjectEvidence[]
  documents: ProjectDocument[]
  history: ProjectHistoryEvent[]
  costs: ProjectCosts
  stats: {
    activeTasks: number
    completedTasks: number
    evidenceFiles: number
    progress: number
  }
}

export type NewProjectInput = {
  name: string
  code: string
  client: string
  type: ProjectType
  location: string
  /** Link Maps / coordenadas inline; opcional. Se resuelve a latitude/longitude al guardar. */
  sharedLocation?: string
  latitude?: number | null
  longitude?: number | null
  description: string
  startDate?: string
  endDate?: string
  supervisor: string
}

export type PauseProjectInput = {
  reason: ProjectPauseReason
  notes?: string
}
