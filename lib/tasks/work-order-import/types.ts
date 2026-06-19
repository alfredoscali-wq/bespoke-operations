import type { WorkOrderServiceType, WorkOrderTechnology } from "@/lib/tasks/work-order"

export type ImportValidationLevel = "valid" | "warning" | "error"

export type ImportIssue = {
  level: "error" | "warning"
  field?: string
  message: string
  suggestion?: string
}

export type WorkOrderImportRowData = {
  serviceType: WorkOrderServiceType | ""
  customerName: string
  customerPhone: string
  customerEmail: string
  customerId: string
  scheduledDate: string
  crewName: string
  crewId: string
  observations: string
  address: string
  locality: string
  technology: WorkOrderTechnology | ""
  currentAddress: string
  newAddress: string
  currentLocality: string
  newLocality: string
  currentTechnology: WorkOrderTechnology | ""
  newTechnology: WorkOrderTechnology | ""
  serviceReason: string
  serviceDetail: string
  cancellationReason: string
  equipmentToRemove: string
  surveyReason: string
  postventaDetail: string
  customerCompany: string
  externalReference: string
  clientOrderNumber: string
  province: string
  postalCode: string
}

export type WorkOrderImportReviewRow = {
  id: string
  rowNumber: number
  selected: boolean
  data: WorkOrderImportRowData
  issues: ImportIssue[]
  status: ImportValidationLevel
}

export type WorkOrderImportSummary = {
  total: number
  valid: number
  warnings: number
  errors: number
}

export type WorkOrderImportReportRow = {
  fila: number
  resultado: string
  error: string
  sugerencia: string
}

export type WorkOrderImportExecutionResult = {
  analyzed: number
  imported: number
  importedWithWarnings: number
  excluded: number
  failed: number
  reportRows: WorkOrderImportReportRow[]
}

export type WorkOrderImportEditableField =
  | "serviceType"
  | "customerName"
  | "scheduledDate"
  | "crewName"
  | "observations"
  | "address"
  | "locality"
  | "technology"
