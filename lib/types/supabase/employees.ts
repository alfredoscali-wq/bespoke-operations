import type {
  EmploymentStatus,
  EmployeeType,
  SystemRole,
} from "@/lib/types/employees"

export type CreateEmployeePayload = {
  companyId?: string
  employeeCode: string
  firstName: string
  lastName: string
  preferredName?: string | null
  nationalId?: string | null
  birthDate?: string | null
  email?: string | null
  phone?: string | null
  jobTitle?: string
  department?: string
  employeeType?: EmployeeType
  employeeTypeId?: string | null
  employmentStatus?: EmploymentStatus
  hireDate?: string | null
  terminationDate?: string | null
  notes?: string
  appUserId?: string | null
  systemRole?: SystemRole
  systemAccess?: boolean
  mustChangePassword?: boolean
  roleId?: string | null
  lastLoginAt?: string | null
}

export type UpdateEmployeePayload = Partial<{
  employeeCode: string
  firstName: string
  lastName: string
  preferredName: string | null
  nationalId: string | null
  birthDate: string | null
  email: string | null
  phone: string | null
  jobTitle: string
  department: string
  employeeType: EmployeeType
  employeeTypeId: string | null
  employmentStatus: EmploymentStatus
  hireDate: string | null
  terminationDate: string | null
  notes: string
  appUserId: string | null
  systemRole: SystemRole
  systemAccess: boolean
  mustChangePassword: boolean
  roleId: string | null
  lastLoginAt: string | null
}>

export type EmployeesRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "DUPLICATE_EMAIL"
  | "VALIDATION"
  | "UNKNOWN"

export type EmployeesRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: EmployeesRepositoryErrorCode
        message: string
      }
    }
