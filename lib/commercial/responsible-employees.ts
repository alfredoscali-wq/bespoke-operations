import type { Employee } from "@/lib/types/employees"

export const COMMERCIAL_SALES_DEPARTMENT = "Ventas"

export function isCommercialSalesEmployee(
  employee: Pick<Employee, "department" | "employmentStatus">
): boolean {
  return (
    employee.employmentStatus === "active" &&
    employee.department.trim().toLocaleLowerCase("es") ===
      COMMERCIAL_SALES_DEPARTMENT.toLocaleLowerCase("es")
  )
}

export function listCommercialResponsibleOptions(
  employees: Array<
    Pick<
      Employee,
      | "id"
      | "firstName"
      | "lastName"
      | "employeeCode"
      | "department"
      | "employmentStatus"
    >
  >
): Array<{ id: string; label: string }> {
  return employees
    .filter(isCommercialSalesEmployee)
    .map((employee) => ({
      id: employee.id,
      label:
        `${employee.firstName} ${employee.lastName}`.trim() ||
        employee.employeeCode,
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, "es", { sensitivity: "base" })
    )
}
