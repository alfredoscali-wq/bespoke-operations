export type TaskStatus =
  | "pendiente"
  | "asignada"
  | "en-curso"
  | "finalizada"
  | "en-aprobacion"
  | "cerrada"

export type TaskType =
  | "fiber"
  | "camera"
  | "wireless"
  | "pole"
  | "maintenance"
  | "inspection"

export type TaskPriority = "alta" | "media" | "baja"

export type ChecklistItem = {
  id: string
  label: string
  completed: boolean
  required: boolean
}

export type Task = {
  id: string
  code: string
  title: string
  description: string
  projectCode: string
  projectName: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  supervisor: string
  crew: string
  startDate: string
  dueDate: string
  estimatedDuration: string
  checklist: ChecklistItem[]
  progress: number
}

export type TaskEvidence = {
  id: string
  title: string
  type: "photo" | "pdf" | "plan" | "video"
  uploadedBy: string
  uploadedAt: string
}

export type TaskComment = {
  id: string
  author: string
  role: "supervisor" | "operario" | "coordinador"
  content: string
  timestamp: string
}

export type TaskHistoryEvent = {
  id: string
  action: string
  description: string
  user: string
  timestamp: string
}

export type TaskDetail = {
  evidence: TaskEvidence[]
  comments: TaskComment[]
  history: TaskHistoryEvent[]
}

export type TaskSortField =
  | "dueDate"
  | "priority"
  | "status"
  | "progress"
  | "code"

export type TaskSortDirection = "asc" | "desc"
