import type {
  Employee,
  EmployeeFilters,
  EmployeeListItem,
  EmployeeSummary,
  EmploymentStatus,
} from "@/lib/types/employees"

export const defaultEmployeeFilters: EmployeeFilters = {
  search: "",
  employmentStatus: "all",
  department: "all",
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
  employee: Pick<Employee, "employeeType">
): boolean {
  return employee.employeeType === "supervisor"
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

export function filterEmployees(
  employees: EmployeeListItem[],
  filters: EmployeeFilters
): EmployeeListItem[] {
  const query = filters.search.trim().toLowerCase()

  return employees.filter((employee) => {
    const matchesSearch =
      query === "" ||
      employee.employeeCode.toLowerCase().includes(query) ||
      employee.firstName.toLowerCase().includes(query) ||
      employee.lastName.toLowerCase().includes(query) ||
      employee.displayName.toLowerCase().includes(query) ||
      (employee.preferredName?.toLowerCase().includes(query) ?? false) ||
      (employee.email?.toLowerCase().includes(query) ?? false) ||
      (employee.phone?.toLowerCase().includes(query) ?? false) ||
      (employee.nationalId?.toLowerCase().includes(query) ?? false) ||
      employee.jobTitle.toLowerCase().includes(query) ||
      employee.department.toLowerCase().includes(query)

    const matchesStatus =
      filters.employmentStatus === "all" ||
      employee.employmentStatus === filters.employmentStatus

    const matchesDepartment =
      filters.department === "all" ||
      employee.department === filters.department

    return matchesSearch && matchesStatus && matchesDepartment
  })
}

function countByStatus(
  employees: Employee[],
  status: EmploymentStatus
): number {
  return employees.filter((employee) => employee.employmentStatus === status)
    .length
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
