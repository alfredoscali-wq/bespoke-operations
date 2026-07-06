import type { IncidentResponse } from "@/lib/types/task-incidents"

export type MobileIncidentCreatedResponse = {
  incidentId: string
  taskId: string
  status: IncidentResponse["status"]
  incidentTypeId: string
  createdAt: string
}

export type MobileIncidentPhotoUploadRequest = {
  deviceId: string
  file: File
}

export type MobileIncidentPhotoUploadResponse = {
  photoId: string
  incidentId: string
  storagePath: string
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
}

export function mapIncidentResponseToMobileCreated(
  incident: IncidentResponse
): MobileIncidentCreatedResponse {
  return {
    incidentId: incident.id,
    taskId: incident.taskId,
    status: incident.status,
    incidentTypeId: incident.incidentTypeId,
    createdAt: incident.createdAt,
  }
}

/**
 * Field Agent contract for incident type configuration.
 */
export type MobileIncidentType = {
  id: string
  code: string
  name: string
  description: string
  color: string
  pausesWorkOrder: boolean
  requiresSupervisorIntervention: boolean
  notifySupervisor: boolean
  sortOrder: number
}
