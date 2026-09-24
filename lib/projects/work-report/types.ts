import type { PROJECT_WORK_REPORT_SECTIONS_V1 } from "@/lib/projects/work-report/options"
import type { ProjectWorkReportTaskScope } from "@/lib/projects/work-report/options"

export type ProjectWorkReportRgb = {
  r: number
  g: number
  b: number
}

export type ProjectWorkReportField = {
  label: string
  value: string
}

export type ProjectWorkReportChecklistItem = {
  label: string
  result: string | null
  completed: boolean
}

export type ProjectWorkReportPhoto = {
  description: string | null
  capturedAt: string | null
  /** Signed URL or data URL for the web gallery. */
  url: string | null
  /** Embedded image used by the PDF renderer. */
  imageDataUrl: string | null
}

export type ProjectWorkReportWorkOrder = {
  code: string
  title: string | null
  status: string | null
  date: string | null
  startDate: string | null
  endDate: string | null
  crew: string | null
  supervisor: string | null
  technicians: string | null
  workType: string | null
  description: string | null
  observations: string | null
  /** Operator-recorded close-out text. Omitted when not registered. */
  trabajoRealizado: string | null
  location: string | null
  fields: ProjectWorkReportField[]
  checklist: ProjectWorkReportChecklistItem[] | null
  photos: ProjectWorkReportPhoto[]
}

export type ProjectWorkReportProject = {
  name: string
  code: string
  client: string | null
  location: string | null
  period: string | null
  description: string | null
}

export type ProjectWorkReportMetadata = {
  generatedAt: string
  generatedAtLabel: string
  taskScope: ProjectWorkReportTaskScope
  includedCount: number
  includedCountLabel: string
  filterNote: string | null
}

export type ProjectWorkReportSummary = {
  filterNote: string | null
  description: string | null
  includedCount: number
  completedCount: number
  activeCount: number
  pendingClosureCount: number
  period: string | null
  crews: string[]
}

/**
 * Canonical informe model. Web, PDF and the public share all consume this
 * object. It must not include company_id, project_id, task UUIDs or other
 * internal infrastructure fields.
 */
export type ProjectWorkReport = {
  kind: "project-work-report"
  version: 1
  metadata: ProjectWorkReportMetadata
  branding: {
    logoUrl: string | null
    logoDataUrl: string | null
    primaryRgb: ProjectWorkReportRgb
    secondaryRgb: ProjectWorkReportRgb | null
  }
  project: ProjectWorkReportProject
  summary: ProjectWorkReportSummary
  workOrders: ProjectWorkReportWorkOrder[]
  /** Alias of metadata.generatedAt (V1 PDF / tests). */
  generatedAt: string
  /** Alias of metadata.taskScope (V1 PDF / tests). */
  taskScope: ProjectWorkReportTaskScope
  sections: typeof PROJECT_WORK_REPORT_SECTIONS_V1
  /** Cover block derived from project + metadata (V1 PDF). */
  cover: {
    title: string
    projectName: string
    projectCode: string
    client: string | null
    location: string | null
    period: string | null
    generatedAtLabel: string
    includedCountLabel: string
  }
  /** Alias of workOrders (V1 PDF / tests). */
  tasks: ProjectWorkReportWorkOrder[]
}

export type ProjectWorkReportData = ProjectWorkReport
export type ProjectWorkReportTaskSection = ProjectWorkReportWorkOrder
