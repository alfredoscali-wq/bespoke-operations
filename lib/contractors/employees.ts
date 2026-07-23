import type { Employee } from "@/lib/types/employees"

export function isContractorEmployee(
  employee: Pick<Employee, "contractorId"> | null | undefined
): boolean {
  return Boolean(employee?.contractorId)
}

export function isInternalEmployee(
  employee: Pick<Employee, "contractorId"> | null | undefined
): boolean {
  return !isContractorEmployee(employee)
}

export function filterInternalEmployees<T extends Pick<Employee, "contractorId">>(
  employees: T[]
): T[] {
  return employees.filter(isInternalEmployee)
}

export function filterContractorEmployees<
  T extends Pick<Employee, "contractorId">,
>(employees: T[], contractorId?: string | null): T[] {
  return employees.filter((employee) => {
    if (!isContractorEmployee(employee)) return false
    if (!contractorId) return true
    return employee.contractorId === contractorId
  })
}

export { buildNextExternalEmployeeCode } from "../employees/employee-codes"

/** DNI is the Auth login identifier once provisioned — must stay locked. */
export function isEmployeeNationalIdLocked(
  employee: Pick<Employee, "appUserId"> | null | undefined
): boolean {
  return Boolean(employee?.appUserId)
}

export function resolveExternalUserAccessLabel(
  employee: Pick<Employee, "appUserId" | "systemAccess">
): string {
  if (!employee.systemAccess) return "Acceso desactivado"
  if (employee.appUserId) return "Provisionado"
  return "Pendiente de provisión"
}
