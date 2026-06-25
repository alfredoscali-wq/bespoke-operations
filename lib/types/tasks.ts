export type TaskStatus =
  | "pendiente"
  | "asignada"
  | "en-curso"
  | "incidencia"
  | "pendiente-cierre"
  | "finalizada"
  | "en-aprobacion"
  | "cerrada"
  | "cancelada"

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

export type OperationalStepKind = "text" | "photo"

export type OperationalStep = {
  id: string
  label: string
  observation: string
  completedAt: string | null
  stepKind?: OperationalStepKind
  stepKey?: string
}

export type TaskOperationMode = "obra" | "servicio"

export type Task = {
  id: string
  code: string
  title: string
  description: string
  projectId?: string
  projectCode: string
  projectName: string
  customerCompany?: string
  customerName?: string
  customerPhone?: string
  customerId?: string
  serviceAddress?: string
  latitude?: number
  longitude?: number
  sharedLocation?: string
  observationsForCrew?: string
  workOrderNumber?: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  supervisor: string
  crewId?: string
  crew: string
  startDate: string
  dueDate: string
  estimatedDuration: string
  checklist: ChecklistItem[]
  operationalSteps?: OperationalStep[]
  progress: number
  createdAt?: string
  completedAt?: string | null
  closedAt?: string | null
  rejectionReason?: string
  incidentReason?: string
  incidentObservation?: string
  incidentReportedAt?: string | null
  incidentReportedBy?: string
  cancellationReason?: string
  cancellationObservation?: string
  serviceType?: string | null
  locality?: string | null
  contractedPlan?: string | null
  installationCost?: number | null
  taskMetadata?: Record<string, unknown>
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
