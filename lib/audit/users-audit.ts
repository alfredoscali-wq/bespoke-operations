import type { Employee, SystemRole, UpdateEmployeeInput } from "@/lib/types/employees"
import { getEmployeeDisplayName } from "@/lib/employees/utils"

export function resolveUserEntityLabel(
  input: Pick<Employee, "employeeCode" | "firstName" | "lastName" | "preferredName" | "id">
) {
  return (
    input.employeeCode?.trim() ||
    getEmployeeDisplayName(input) ||
    input.id
  )
}

export function resolveUserEntityId(employee: Pick<Employee, "id" | "appUserId">) {
  return employee.appUserId ?? employee.id
}

export function buildUserRoleMetadata(
  previousRole: SystemRole,
  nextRole: SystemRole
) {
  return {
    rol_anterior: previousRole,
    rol_nuevo: nextRole,
  }
}

export const USER_ACCOUNT_FIELDS = new Set<keyof UpdateEmployeeInput>([
  "systemAccess",
  "systemRole",
  "mustChangePassword",
])

export function hasUserAccountFieldChanges(input: UpdateEmployeeInput): boolean {
  return (Object.keys(input) as (keyof UpdateEmployeeInput)[]).some(
    (field) => input[field] !== undefined && USER_ACCOUNT_FIELDS.has(field)
  )
}

export function stripUserAccountFieldsFromEmployeeUpdate(
  input: UpdateEmployeeInput
): UpdateEmployeeInput {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key]) => !USER_ACCOUNT_FIELDS.has(key as keyof UpdateEmployeeInput)
    )
  ) as UpdateEmployeeInput
}

export async function recordUserSessionAudit(
  action: "USER_LOGIN" | "USER_LOGOUT"
): Promise<void> {
  try {
    await fetch("/api/auth/audit-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
  } catch {
    // La auditoría no debe bloquear el flujo de autenticación.
  }
}

export type RecordUserAccountAuditInput = {
  before: Employee
  after: Employee
  changes: UpdateEmployeeInput
}

export async function recordUserAccountChangesViaApi(
  input: RecordUserAccountAuditInput
): Promise<void> {
  try {
    await fetch("/api/auth/record-user-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    // La auditoría no debe bloquear la edición del empleado.
  }
}
