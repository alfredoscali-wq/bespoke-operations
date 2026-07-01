import type {
  EmployeeInsert,
  EmployeeRow,
  EmployeeUpdate,
} from "@/lib/supabase/database.types"
import type { Employee } from "@/lib/types/employees"
import type {
  CreateEmployeePayload,
  UpdateEmployeePayload,
} from "@/lib/types/supabase/employees"

function trimOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export function mapEmployeeRowToEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    preferredName: row.preferred_name ?? undefined,
    nationalId: row.national_id ?? undefined,
    birthDate: row.birth_date ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    jobTitle: row.job_title,
    department: row.department,
    employeeType: row.employee_type,
    employmentStatus: row.employment_status,
    hireDate: row.hire_date ?? undefined,
    terminationDate: row.termination_date ?? undefined,
    notes: row.notes,
    appUserId: row.app_user_id,
    systemRole: row.system_role,
    systemAccess: row.system_access,
    mustChangePassword: row.must_change_password,
    roleId: row.role_id,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

export function mapCreateEmployeePayloadToInsert(
  payload: CreateEmployeePayload
): EmployeeInsert {
  return {
    company_id: payload.companyId,
    employee_code: payload.employeeCode.trim(),
    first_name: payload.firstName.trim(),
    last_name: payload.lastName.trim(),
    preferred_name: trimOptional(payload.preferredName),
    national_id: trimOptional(payload.nationalId),
    birth_date: payload.birthDate ?? null,
    email: trimOptional(payload.email),
    phone: trimOptional(payload.phone),
    job_title: payload.jobTitle?.trim() ?? "",
    department: payload.department?.trim() ?? "",
    employee_type: payload.employeeType ?? "operario",
    employment_status: payload.employmentStatus ?? "active",
    hire_date: payload.hireDate ?? null,
    termination_date: payload.terminationDate ?? null,
    notes: payload.notes?.trim() ?? "",
    app_user_id: payload.appUserId ?? null,
    system_role: payload.systemRole ?? "operario",
    system_access: payload.systemAccess ?? false,
    must_change_password: payload.mustChangePassword ?? false,
    role_id: payload.roleId ?? null,
    last_login_at: payload.lastLoginAt ?? null,
  }
}

export function mapUpdateEmployeePayloadToUpdate(
  payload: UpdateEmployeePayload
): EmployeeUpdate {
  const update: EmployeeUpdate = {}

  if (payload.employeeCode !== undefined) {
    update.employee_code = payload.employeeCode.trim()
  }
  if (payload.firstName !== undefined) {
    update.first_name = payload.firstName.trim()
  }
  if (payload.lastName !== undefined) {
    update.last_name = payload.lastName.trim()
  }
  if (payload.preferredName !== undefined) {
    update.preferred_name = trimOptional(payload.preferredName)
  }
  if (payload.nationalId !== undefined) {
    update.national_id = trimOptional(payload.nationalId)
  }
  if (payload.birthDate !== undefined) {
    update.birth_date = payload.birthDate
  }
  if (payload.email !== undefined) {
    update.email = trimOptional(payload.email)
  }
  if (payload.phone !== undefined) {
    update.phone = trimOptional(payload.phone)
  }
  if (payload.jobTitle !== undefined) {
    update.job_title = payload.jobTitle.trim()
  }
  if (payload.department !== undefined) {
    update.department = payload.department.trim()
  }
  if (payload.employeeType !== undefined) {
    update.employee_type = payload.employeeType
  }
  if (payload.employmentStatus !== undefined) {
    update.employment_status = payload.employmentStatus
  }
  if (payload.hireDate !== undefined) {
    update.hire_date = payload.hireDate
  }
  if (payload.terminationDate !== undefined) {
    update.termination_date = payload.terminationDate
  }
  if (payload.notes !== undefined) {
    update.notes = payload.notes.trim()
  }
  if (payload.appUserId !== undefined) {
    update.app_user_id = payload.appUserId
  }
  if (payload.systemRole !== undefined) {
    update.system_role = payload.systemRole
  }
  if (payload.roleId !== undefined) {
    update.role_id = payload.roleId
  }
  if (payload.systemAccess !== undefined) {
    update.system_access = payload.systemAccess
  }
  if (payload.mustChangePassword !== undefined) {
    update.must_change_password = payload.mustChangePassword
  }
  if (payload.lastLoginAt !== undefined) {
    update.last_login_at = payload.lastLoginAt
  }

  return update
}
