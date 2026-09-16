import type { ProjectDesignElementKind } from "@/lib/types/project-design"
import type { OperationalChecklistTemplateItem } from "@/lib/tasks/operational-checklist-template"
import type { TaskPriority, TaskType } from "@/lib/types/tasks"

export const PROJECT_DESIGN_OT_WORK_TYPES = [
  "node",
  "nap",
  "tendido",
  "drop",
  "otro",
] as const

export type ProjectDesignOtWorkType =
  (typeof PROJECT_DESIGN_OT_WORK_TYPES)[number]

export const PROJECT_DESIGN_OT_GENERATABLE_WORK_TYPES = [
  "node",
  "nap",
] as const satisfies readonly ProjectDesignOtWorkType[]

export type ProjectDesignOtGeneratableWorkType =
  (typeof PROJECT_DESIGN_OT_GENERATABLE_WORK_TYPES)[number]

export const PROJECT_DESIGN_OT_PROPOSAL_STATUSES = [
  "draft",
  "ready",
  "created",
  "cancelled",
] as const

export type ProjectDesignOtProposalStatus =
  (typeof PROJECT_DESIGN_OT_PROPOSAL_STATUSES)[number]

export type ProjectDesignOtProposal = {
  id: string
  companyId: string
  projectId: string
  sourceElementId: string
  sourceElementKind: ProjectDesignElementKind
  status: ProjectDesignOtProposalStatus
  title: string
  workType: ProjectDesignOtWorkType
  priority: TaskPriority | null
  crewId: string | null
  startDate: string | null
  dueDate: string | null
  latitude: number | null
  longitude: number | null
  observations: string
  designName: string
  designColor: string
  designIcon: string
  designGainM: number
  operationalChecklistTemplate: OperationalChecklistTemplateItem[]
  taskId: string | null
  createdAt: string
  updatedAt: string
}

export type CreateProjectDesignOtProposalInput = {
  companyId: string
  projectId: string
  sourceElementId: string
  sourceElementKind: ProjectDesignElementKind
  title: string
  workType: ProjectDesignOtWorkType
  priority?: TaskPriority | null
  crewId?: string | null
  startDate?: string | null
  dueDate?: string | null
  latitude?: number | null
  longitude?: number | null
  observations?: string
  designName?: string
  designColor?: string
  designIcon?: string
  designGainM?: number
  operationalChecklistTemplate?: OperationalChecklistTemplateItem[]
  status?: ProjectDesignOtProposalStatus
}

export type UpdateProjectDesignOtProposalInput = {
  title?: string
  workType?: ProjectDesignOtWorkType
  priority?: TaskPriority | null
  crewId?: string | null
  startDate?: string | null
  dueDate?: string | null
  latitude?: number | null
  longitude?: number | null
  observations?: string
  operationalChecklistTemplate?: OperationalChecklistTemplateItem[]
  status?: ProjectDesignOtProposalStatus
  taskId?: string | null
}

export const PROJECT_DESIGN_SOURCE_METADATA_KEY = "projectDesignSource"
export const PROJECT_DESIGN_WORK_TYPE_METADATA_KEY = "projectDesignWorkType"
export const PROJECT_DESIGN_PLAN_SNAPSHOT_METADATA_KEY =
  "projectDesignPlanSnapshot"

export type ProjectDesignElementSourceMetadata = {
  kind: ProjectDesignOtGeneratableWorkType
  elementId: string
  proposalId: string
  identifier: string
  plannedGainM: number
}

export type ProjectDesignSegmentsSourceMetadata = {
  kind: "segments"
  segmentIds: string[]
}

export type ProjectDesignSourceMetadata =
  | ProjectDesignElementSourceMetadata
  | ProjectDesignSegmentsSourceMetadata

export type ProjectDesignTendidoPlanSegment = {
  id: string
  label: string
  type: "tendido" | "drop" | "otro"
  plannedLengthM: number
}

export type ProjectDesignTendidoPlanSnapshot = {
  capturedAt: string
  workType: "tendido"
  segmentIds: string[]
  segments: ProjectDesignTendidoPlanSegment[]
  gainIds: string[]
  plannedLengthM: number
  traceGainM: number
  plannedCableM: number
}

export type ProjectDesignTaskCreateSnapshot = {
  projectId: string
  projectCode: string
  projectName: string
  title: string
  description: string
  observationsForCrew: string
  type: TaskType
  priority: TaskPriority
  supervisor: string
  crewId: string
  crew: string
  startDate: string
  dueDate: string
  estimatedDuration: string
  latitude?: number
  longitude?: number
  checklist: []
  operationalChecklistTemplate: OperationalChecklistTemplateItem[]
  taskMetadata: Record<string, unknown>
}
