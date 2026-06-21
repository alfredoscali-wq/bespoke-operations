import type { WorkOrderTechnology } from "@/lib/tasks/work-order"

export type ImportValidationLevel = "valid" | "warning" | "error"

export type ImportIssue = {
  level: "error" | "warning"
  field?: string
  message: string
  suggestion?: string
}

export type CustomerImportStatus = "activo" | "inactivo" | ""

export type CustomerImportRowData = {
  externalCustomerCode: string
  name: string
  phone: string
  email: string
  address: string
  locality: string
  technology: WorkOrderTechnology | ""
  status: CustomerImportStatus
}

export type CustomerImportReviewRow = {
  id: string
  rowNumber: number
  selected: boolean
  data: CustomerImportRowData
  issues: ImportIssue[]
  status: ImportValidationLevel
}

export type CustomerImportSummary = {
  total: number
  valid: number
  warnings: number
  errors: number
}

export type CustomerImportReportRow = {
  fila: number
  resultado: string
  error: string
  sugerencia: string
}

export type CustomerImportExecutionResult = {
  analyzed: number
  imported: number
  importedWithWarnings: number
  excluded: number
  failed: number
  reportRows: CustomerImportReportRow[]
}

export type CustomerImportEditableField =
  | "externalCustomerCode"
  | "name"
  | "phone"
  | "email"
  | "address"
  | "locality"
  | "technology"
  | "status"
