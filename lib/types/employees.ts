export type EmploymentStatus =
  | "active"
  | "vacation"
  | "medical_leave"
  | "training"
  | "suspended"
  | "inactive"

export type EmployeeType =
  | "operario"
  | "supervisor"
  | "administrativo"
  | "gerente"
  | "otro"

export type SystemRole =
  | "administrador"
  | "supervisor"
  | "administrativo"
  | "operario"

export type Employee = {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  preferredName?: string
  nationalId?: string
  birthDate?: string
  email?: string
  phone?: string
  jobTitle: string
  department: string
  employeeType: EmployeeType
  employmentStatus: EmploymentStatus
  hireDate?: string
  terminationDate?: string
  notes: string
  appUserId?: string | null
  systemRole: SystemRole
  systemAccess: boolean
  mustChangePassword: boolean
  lastLoginAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type EmployeeListItem = Employee & {
  displayName: string
  initials: string
}

export type EmployeeProvisionStatus =
  | "no_system_access"
  | "pending_provision"
  | "provisioned"
  | "inconsistent"

export type EmployeeSummary = {
  total: number
  active: number
  vacation: number
  medicalLeave: number
  training: number
  suspended: number
  inactive: number
  available: number
  administradores: number
  supervisores: number
  administrativos: number
  operarios: number
  provisionedUsers: number
  pendingProvision: number
}

export type EmployeeSystemAccessFilter = "all" | "with" | "without"

export type EmployeeSortColumn =
  | "employeeCode"
  | "nationalId"
  | "displayName"
  | "jobTitle"
  | "email"
  | "systemAccess"
  | "systemRole"
  | "employmentStatus"

export type EmployeeSortDirection = "asc" | "desc"

export type EmployeeSortState = {
  column: EmployeeSortColumn
  direction: EmployeeSortDirection
} | null

export type EmployeeFilters = {
  search: string
  employmentStatus: EmploymentStatus | "all"
  department: string | "all"
  systemRole: SystemRole | "all"
  systemAccess: EmployeeSystemAccessFilter
  provision: "all" | "pending" | "provisioned"
}

export type NewEmployeeInput = {
  employeeCode: string
  firstName: string
  lastName: string
  preferredName?: string
  nationalId?: string
  birthDate?: string
  email?: string
  phone?: string
  jobTitle?: string
  department?: string
  employeeType?: EmployeeType
  employmentStatus?: EmploymentStatus
  hireDate?: string
  terminationDate?: string
  notes?: string
  appUserId?: string | null
  systemRole?: SystemRole
  systemAccess?: boolean
  mustChangePassword?: boolean
  lastLoginAt?: string | null
}

export type UpdateEmployeeInput = Partial<NewEmployeeInput>
