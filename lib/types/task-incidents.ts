export type TaskIncidentStatus =
  | "REPORTADA"
  | "EN_ANALISIS"
  | "RESUELTA"
  | "RECHAZADA"

export type TaskIncident = {
  id: string
  companyId: string
  taskId: string
  employeeId: string
  crewId?: string | null
  incidentTypeId: string
  status: TaskIncidentStatus
  comment?: string | null
  canContinue: boolean
  requiresSupervisorAction: boolean
  resolvedBy?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type TaskIncidentPhoto = {
  id: string
  incidentId: string
  storagePath: string
  thumbnailPath?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  createdBy: string
  createdAt: string
}

export type TaskIncidentEvent = {
  id: string
  incidentId: string
  eventType: string
  comment?: string | null
  createdBy: string
  createdAt: string
}

export type CreateTaskIncidentInput = {
  taskId: string
  employeeId: string
  crewId?: string | null
  incidentTypeId: string
  status?: TaskIncidentStatus
  comment?: string | null
  canContinue?: boolean
  requiresSupervisorAction?: boolean
}

export type UpdateTaskIncidentInput = {
  status?: TaskIncidentStatus
  comment?: string | null
  canContinue?: boolean
  requiresSupervisorAction?: boolean
  resolvedBy?: string | null
  resolvedAt?: string | null
  deletedAt?: string | null
}

export type CreateTaskIncidentPhotoInput = {
  incidentId: string
  storagePath: string
  thumbnailPath?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  createdBy: string
}

export type CreateTaskIncidentEventInput = {
  incidentId: string
  eventType: string
  comment?: string | null
  createdBy: string
}

export type CreateIncidentRequest = {
  taskId: string
  employeeId: string
  crewId?: string | null
  incidentTypeId: string
  comment?: string | null
  canContinue?: boolean
  requiresSupervisorAction?: boolean
}

export type UpdateIncidentStatusRequest = {
  status: TaskIncidentStatus
  comment?: string | null
  canContinue?: boolean
  requiresSupervisorAction?: boolean
  auditExplicitClosure?: boolean
}

export type AddIncidentPhotoRequest = {
  storagePath: string
  thumbnailPath?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
}

export type AddIncidentEventRequest = {
  eventType: string
  comment?: string | null
}

export type IncidentSummary = {
  id: string
  companyId: string
  taskId: string
  employeeId: string
  crewId?: string | null
  incidentTypeId: string
  status: TaskIncidentStatus
  comment?: string | null
  canContinue: boolean
  requiresSupervisorAction: boolean
  resolvedBy?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type IncidentResponse = IncidentSummary & {
  photos: TaskIncidentPhoto[]
  events: TaskIncidentEvent[]
}
