import type {
  CreateTaskIncidentInput,
  TaskIncident,
  TaskIncidentEvent,
  TaskIncidentPhoto,
  TaskIncidentStatus,
  UpdateTaskIncidentInput,
} from "@/lib/types/task-incidents"

export type CreateTaskIncidentPayload = CreateTaskIncidentInput & {
  companyId: string
}

export type UpdateTaskIncidentStatusPayload = UpdateTaskIncidentInput & {
  status: TaskIncidentStatus
}

export type CreateTaskIncidentPhotoPayload = {
  incidentId: string
  storagePath: string
  thumbnailPath?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  createdBy: string
}

export type CreateTaskIncidentEventPayload = {
  incidentId: string
  eventType: string
  comment?: string | null
  createdBy: string
}

export type ListTaskIncidentsFilters = {
  taskId?: string
  activeOnly?: boolean
  status?: TaskIncidentStatus
}

export type TaskIncidentsRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_ACTIVE"
  | "VALIDATION"
  | "WORKFLOW"
  | "FORBIDDEN"
  | "UNKNOWN"

export type TaskIncidentsRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: TaskIncidentsRepositoryErrorCode
        message: string
      }
    }

export type TaskIncidentDetail = TaskIncident & {
  photos: TaskIncidentPhoto[]
  events: TaskIncidentEvent[]
}
