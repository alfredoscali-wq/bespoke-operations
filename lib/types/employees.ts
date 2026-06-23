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

export type EmployeeSummary = {
  total: number
  active: number
  vacation: number
  medicalLeave: number
  training: number
  suspended: number
  inactive: number
  available: number
}

export type EmployeeFilters = {
  search: string
  employmentStatus: EmploymentStatus | "all"
  department: string | "all"
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
