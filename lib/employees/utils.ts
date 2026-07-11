import {
  EMPLOYEE_TYPE_LABELS,
  SYSTEM_ROLE_LABELS,
} from "@/lib/employees/constants"
import { getEmployeeTypeDisplayName, isSupervisorEmployeeType, resolveLegacyEmployeeTypeFromCatalogCode } from "@/lib/employees/employee-type-legacy"
import type {
  Employee,
  EmployeeFilters,
  EmployeeListItem,
  EmployeeProvisionStatus,
  EmployeeSortColumn,
  EmployeeSortState,
  EmployeeSummary,
  EmploymentStatus,
  SystemRole,
} from "@/lib/types/employees"
import type { EmployeeTypeCatalog } from "@/lib/types/employee-types"

export const defaultEmployeeFilters: EmployeeFilters = {
  search: "",
  employmentStatus: "all",
  department: "all",
  employeeTypeId: "all",
  systemRole: "all",
  systemAccess: "all",
  provision: "all",
}

export function getEmployeeDisplayName(
  employee: Pick<Employee, "firstName" | "lastName" | "preferredName">
): string {
  const preferred = employee.preferredName?.trim()
  if (preferred) return preferred

  return getEmployeeFullName(employee)
}

export function getEmployeeFullName(
  employee: Pick<Employee, "firstName" | "lastName">
): string {
  return [employee.firstName, employee.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
}

/** Legal full name for RRHH table (firstName + lastName, never preferredName). */
export function formatEmployeeTableFullName(
  employee: Pick<Employee, "firstName" | "lastName">
): string {
  return getEmployeeFullName(employee).toLocaleUpperCase("es")
}

export function resolveEmployeeProvisionStatus(
  employee: Pick<Employee, "systemAccess" | "appUserId">
): EmployeeProvisionStatus {
  const hasAppUser = Boolean(employee.appUserId)

  if (!employee.systemAccess && !hasAppUser) {
    return "no_system_access"
  }

  if (!employee.systemAccess && hasAppUser) {
    return "inconsistent"
  }

  if (employee.systemAccess && !hasAppUser) {
    return "pending_provision"
  }

  return "provisioned"
}

export function canProvisionEmployeeAccess(
  employee: Pick<Employee, "systemAccess" | "appUserId">
): boolean {
  return employee.systemAccess && !employee.appUserId
}

export function canResetEmployeePassword(
  employee: Pick<Employee, "appUserId">
): boolean {
  return Boolean(employee.appUserId)
}

export function getEmployeeInitials(
  employee: Pick<Employee, "firstName" | "lastName" | "preferredName">
): string {
  const preferred = employee.preferredName?.trim()
  if (preferred) {
    const parts = preferred.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
    }
    return preferred.slice(0, 2).toUpperCase()
  }

  const first = employee.firstName.trim()[0] ?? ""
  const last = employee.lastName.trim()[0] ?? ""
  return `${first}${last}`.toUpperCase()
}

export function isEmployeeAvailable(
  employee: Pick<Employee, "employmentStatus">
): boolean {
  return employee.employmentStatus === "active"
}

export function isSupervisorEmployee(
  employee: Pick<Employee, "employeeType" | "employeeTypeRecord">
): boolean {
  return isSupervisorEmployeeType(employee)
}

export function getSupervisorEmployees(employees: Employee[]): Employee[] {
  return employees
    .filter(isEmployeeAvailable)
    .filter(isSupervisorEmployee)
    .sort((a, b) => {
      const codeCompare = a.employeeCode.localeCompare(b.employeeCode, "es")
      if (codeCompare !== 0) return codeCompare
      return getEmployeeFullName(a).localeCompare(getEmployeeFullName(b), "es")
    })
}

export function resolveSupervisorDisplayName(
  employee: Pick<Employee, "firstName" | "lastName" | "preferredName">
): string {
  return getEmployeeDisplayName(employee)
}

export function buildEmployeeListItem(employee: Employee): EmployeeListItem {
  return {
    ...employee,
    displayName: getEmployeeDisplayName(employee),
    initials: getEmployeeInitials(employee),
  }
}

export function buildEmployeeListItems(
  employees: Employee[]
): EmployeeListItem[] {
  return employees.map(buildEmployeeListItem)
}

function employeeMatchesSearch(
  employee: EmployeeListItem,
  query: string
): boolean {
  if (!query) return true

  const searchableValues = [
    employee.employeeCode,
    employee.firstName,
    employee.lastName,
    employee.displayName,
    employee.preferredName ?? "",
    employee.nationalId ?? "",
    employee.email ?? "",
    employee.jobTitle,
    getEmployeeTypeDisplayName(employee),
    EMPLOYEE_TYPE_LABELS[employee.employeeType],
    SYSTEM_ROLE_LABELS[employee.systemRole],
  ]

  return searchableValues.some((value) =>
    value.toLowerCase().includes(query)
  )
}

export function employeeMatchesEmployeeTypeFilter(
  employee: Pick<Employee, "employeeTypeId" | "employeeType">,
  filterTypeId: string,
  catalog: EmployeeTypeCatalog[]
): boolean {
  if (employee.employeeTypeId === filterTypeId) {
    return true
  }

  if (employee.employeeTypeId) {
    return false
  }

  const selected = catalog.find((item) => item.id === filterTypeId)
  if (!selected) {
    return false
  }

  return (
    employee.employeeType ===
    resolveLegacyEmployeeTypeFromCatalogCode(selected.code)
  )
}

export function filterEmployees(
  employees: EmployeeListItem[],
  filters: EmployeeFilters,
  options?: { employeeTypeCatalog?: EmployeeTypeCatalog[] }
): EmployeeListItem[] {
  const query = filters.search.trim().toLowerCase()

  return employees.filter((employee) => {
    const matchesSearch = employeeMatchesSearch(employee, query)

    const matchesStatus =
      filters.employmentStatus === "all" ||
      employee.employmentStatus === filters.employmentStatus

    const matchesDepartment =
      filters.department === "all" ||
      employee.department === filters.department

    const matchesEmployeeType =
      filters.employeeTypeId === "all" ||
      (options?.employeeTypeCatalog
        ? employeeMatchesEmployeeTypeFilter(
            employee,
            filters.employeeTypeId,
            options.employeeTypeCatalog
          )
        : employee.employeeTypeId === filters.employeeTypeId)

    const matchesSystemRole =
      filters.systemRole === "all" ||
      employee.systemRole === filters.systemRole

    const matchesSystemAccess =
      filters.systemAccess === "all" ||
      (filters.systemAccess === "with"
        ? employee.systemAccess
        : !employee.systemAccess)

    const matchesProvision =
      filters.provision === "all" ||
      (filters.provision === "pending"
        ? employee.systemAccess && !employee.appUserId
        : Boolean(employee.appUserId))

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDepartment &&
      matchesEmployeeType &&
      matchesSystemRole &&
      matchesSystemAccess &&
      matchesProvision
    )
  })
}

function compareStrings(
  left: string,
  right: string,
  direction: "asc" | "desc"
): number {
  const result = left.localeCompare(right, "es", { sensitivity: "base" })
  return direction === "asc" ? result : -result
}

function getSortableString(
  employee: EmployeeListItem,
  column: EmployeeSortColumn
): string {
  switch (column) {
    case "employeeCode":
      return employee.employeeCode
    case "nationalId":
      return employee.nationalId ?? ""
    case "displayName":
      return getEmployeeFullName(employee)
    case "jobTitle":
      return employee.jobTitle
    case "email":
      return employee.email ?? ""
    case "systemAccess":
      return employee.systemAccess ? "1" : "0"
    case "employmentStatus":
      return employee.employmentStatus
    case "systemRole":
      return SYSTEM_ROLE_LABELS[employee.systemRole]
    default:
      return ""
  }
}

export function sortEmployees(
  employees: EmployeeListItem[],
  sort: EmployeeSortState
): EmployeeListItem[] {
  if (!sort) return employees

  const sorted = [...employees]

  sorted.sort((left, right) =>
    compareStrings(
      getSortableString(left, sort.column),
      getSortableString(right, sort.column),
      sort.direction
    )
  )

  return sorted
}

export function cycleEmployeeSort(
  current: EmployeeSortState,
  column: EmployeeSortColumn
): EmployeeSortState {
  if (current?.column !== column) {
    return { column, direction: "asc" }
  }

  if (current.direction === "asc") {
    return { column, direction: "desc" }
  }

  return null
}

function countByStatus(
  employees: Employee[],
  status: EmploymentStatus
): number {
  return employees.filter((employee) => employee.employmentStatus === status)
    .length
}

function countBySystemRole(
  employees: Employee[],
  role: SystemRole
): number {
  return employees.filter((employee) => employee.systemRole === role).length
}

export function getEmployeeSummary(employees: Employee[]): EmployeeSummary {
  return {
    total: employees.length,
    active: countByStatus(employees, "active"),
    vacation: countByStatus(employees, "vacation"),
    medicalLeave: countByStatus(employees, "medical_leave"),
    training: countByStatus(employees, "training"),
    suspended: countByStatus(employees, "suspended"),
    inactive: countByStatus(employees, "inactive"),
    available: employees.filter(isEmployeeAvailable).length,
    administradores: countBySystemRole(employees, "administrador"),
    supervisores: countBySystemRole(employees, "supervisor"),
    administrativos: countBySystemRole(employees, "administrativo"),
    operarios: countBySystemRole(employees, "operario"),
    provisionedUsers: employees.filter((employee) => employee.appUserId).length,
    pendingProvision: employees.filter(
      (employee) => employee.systemAccess && !employee.appUserId
    ).length,
  }
}

export function getDepartmentOptions(employees: Employee[]): string[] {
  return Array.from(
    new Set(
      employees
        .map((employee) => employee.department.trim())
        .filter((department) => department !== "")
    )
  ).sort((a, b) => a.localeCompare(b, "es"))
}
