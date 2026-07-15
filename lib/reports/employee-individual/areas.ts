import { isSupervisorEmployeeType } from "@/lib/employees/employee-type-legacy"
import type { Employee } from "@/lib/types/employees"

export type EmployeeReportArea =
  | "tecnica"
  | "ventas"
  | "atencion"
  | "rrhh"
  | "supervision"
  | "general"

export const EMPLOYEE_REPORT_AREA_LABELS: Record<EmployeeReportArea, string> = {
  tecnica: "Técnica",
  ventas: "Ventas",
  atencion: "Atención al Cliente",
  rrhh: "RRHH",
  supervision: "Supervisión",
  general: "General",
}

export const EMPLOYEE_REPORT_AREA_FILTER_OPTIONS: Array<{
  value: EmployeeReportArea | "all"
  label: string
}> = [
  { value: "all", label: "Todas las áreas" },
  { value: "tecnica", label: "Técnica" },
  { value: "ventas", label: "Ventas" },
  { value: "atencion", label: "Atención al Cliente" },
  { value: "rrhh", label: "RRHH" },
  { value: "supervision", label: "Supervisión" },
  { value: "general", label: "General" },
]

function normalizeDepartment(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("es")
}

/**
 * Resolves the KPI profile from employee department / type.
 * Supervisión is primarily type-based (not always present as form area).
 */
export function resolveEmployeeReportArea(
  employee: Pick<Employee, "department" | "employeeType" | "employeeTypeRecord">
): EmployeeReportArea {
  if (
    isSupervisorEmployeeType(employee) ||
    employee.employeeType === "supervisor"
  ) {
    return "supervision"
  }

  const department = normalizeDepartment(employee.department)

  if (
    department.includes("atenci") ||
    department.includes("cliente") ||
    department === "ac"
  ) {
    return "atencion"
  }

  if (department.includes("venta")) {
    return "ventas"
  }

  if (
    department.includes("rrhh") ||
    department.includes("recursos humanos") ||
    department.includes("humano")
  ) {
    return "rrhh"
  }

  if (
    department.includes("supervis") ||
    department.includes("coordin")
  ) {
    return "supervision"
  }

  if (
    department.includes("técnic") ||
    department.includes("tecnic") ||
    department.includes("operari") ||
    department.includes("campo") ||
    department.includes("operacion")
  ) {
    return "tecnica"
  }

  if (department.includes("admin")) {
    return "general"
  }

  return "general"
}

export function employeeMatchesAreaFilter(
  employee: Pick<Employee, "department" | "employeeType" | "employeeTypeRecord">,
  areaFilter: EmployeeReportArea | "all"
): boolean {
  if (areaFilter === "all") {
    return true
  }

  return resolveEmployeeReportArea(employee) === areaFilter
}
