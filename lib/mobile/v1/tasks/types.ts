import type { TaskPriority, TaskStatus } from "@/lib/types/tasks"
import type { MobileChecklistFieldType } from "@/lib/mobile/v1/checklist/types"

export type MobileTaskChecklistResponseValue = {
  confirmed?: boolean
  textValue?: string
  photoIds?: string[]
}

export type MobileTaskChecklistItem = {
  id: string
  label: string
  fieldType: MobileChecklistFieldType
  required: boolean
  sortOrder: number
  confirmed?: boolean | null
  textValue?: string | null
  photoIds?: string[]
  completed?: boolean
}

export type MobileTaskEvidenceRequirement = {
  id: string
  label: string
  stepKind: "text" | "photo"
  required: boolean
}

export type MobileTaskNextWorkItem = {
  scheduledTime: string | null
  workType: string
  customerOrAssetName: string
}

export type MobileTaskReferencePhoto = {
  id: string
  fileName: string
  description: string
  url: string
}

export type MobileTaskDetailResponse = {
  id: string
  workOrderNumber: string | null
  workType: string
  serviceType: string | null
  status: TaskStatus
  priority: TaskPriority
  scheduledTime: string | null
  customerOrAssetName: string
  contactPerson: string | null
  phone: string | null
  address: string
  locality: string | null
  latitude: number | null
  longitude: number | null
  observations: string | null
  amountToCollect: number | null
  technology: string | null
  contractedPlan: string | null
  installationIp: string | null
  /** Snake_case alias for legacy Field Agent clients. */
  installation_ip: string | null
  serviceReason: string | null
  serviceDetail: string | null
  checklist: MobileTaskChecklistItem[]
  evidenceRequirements: MobileTaskEvidenceRequirement[]
  referencePhotos: MobileTaskReferencePhoto[]
  nextWork: MobileTaskNextWorkItem | null
  hasActiveIncident: boolean
}

export type MobileTaskStartRequest = {
  deviceId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
}

export type MobileTaskStartResponse = {
  id: string
  status: TaskStatus
  startedAt: string
  checklist: MobileTaskChecklistItem[]
  technology: string | null
  contractedPlan: string | null
  installationIp: string | null
  installation_ip: string | null
  amountToCollect: number | null
}

export type MobileTaskIncidentType = {
  id: string
  code: string
  name: string
  description: string
  color: string
  required: boolean
  sortOrder: number
}

export type MobileTaskIncidentTypesResponse = {
  serviceType: string | null
  items: MobileTaskIncidentType[]
}

export type MobileTaskChecklistResponseRequest = {
  deviceId: string
  itemId: string
  confirmed?: boolean
  textValue?: string | null
}

export type MobileTaskChecklistResponseUpdate = {
  id: string
  status: TaskStatus
  checklist: MobileTaskChecklistItem[]
}

export type MobileTaskChecklistPhotoRequest = {
  deviceId: string
  checklistItemId: string
  file: File
}

export type MobileTaskChecklistPhotoResponse = {
  photoId: string
  checklistItemId: string
  checklist: MobileTaskChecklistItem[]
}

export type MobileTaskReportIncidentRequest = {
  deviceId: string
  incidentTypeCode: string
  observation?: string | null
  photoIds?: string[]
}

export type MobileTaskReportIncidentResponse = {
  id: string
  status: TaskStatus
  incidentId: string
}

export type MobileTaskSubmitForApprovalRequest = {
  deviceId: string
  /** Free-text documentation of work actually performed (required to close). */
  trabajoRealizado: string
}

export type MobileTaskSubmitForApprovalResponse = {
  id: string
  status: TaskStatus
}
