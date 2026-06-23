import type {
  EmployeeType,
  EmploymentStatus,
  NewEmployeeInput,
  SystemRole,
} from "@/lib/types/employees"

export type ImportValidationLevel = "valid" | "error"

export type EmployeeImportField = keyof EmployeeImportRowData

export type EmployeeImportRowData = {
  nationalId: string
  firstName: string
  lastName: string
  preferredName: string
  email: string
  phone: string
  jobTitle: string
  department: string
  employeeType: string
  employmentStatus: string
  hireDate: string
  birthDate: string
  systemAccess: string
  systemRole: string
  notes: string
}

export type EmployeeImportIssue = {
  level: ImportValidationLevel
  field?: EmployeeImportField
  message: string
}

export type EmployeeImportReviewRow = {
  id: string
  rowNumber: number
  data: EmployeeImportRowData
  issues: EmployeeImportIssue[]
  status: ImportValidationLevel
  payload?: NewEmployeeInput
}

export type EmployeeImportSummary = {
  total: number
  valid: number
  errors: number
}

export type EmployeeImportFailureDetail = {
  rowNumber: number
  message: string
}

export type EmployeeImportExecutionResult = {
  total: number
  created: number
  failed: number
  skipped: number
  failures: EmployeeImportFailureDetail[]
}

export type ResolvedImportEnums = {
  employeeType: EmployeeType
  employmentStatus: EmploymentStatus
  systemAccess: boolean
  systemRole: SystemRole
}
