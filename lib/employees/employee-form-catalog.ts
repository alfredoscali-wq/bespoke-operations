export const EMPLOYEE_FORM_AREA_OPTIONS = [
  "Administración",
  "Atención al Cliente",
  "Ventas",
  "RRHH",
  "Técnica",
  "Operario",
] as const

export type EmployeeFormAreaOption = (typeof EMPLOYEE_FORM_AREA_OPTIONS)[number]

export function buildEmployeeFormAreaOptions(
  currentDepartment?: string | null
): string[] {
  const options = [...EMPLOYEE_FORM_AREA_OPTIONS]
  const trimmed = currentDepartment?.trim()

  if (trimmed && !options.includes(trimmed as EmployeeFormAreaOption)) {
    return [trimmed, ...options]
  }

  return options
}

export function resolveEmployeeFormDepartmentDefault(
  currentDepartment?: string | null
): string {
  const trimmed = currentDepartment?.trim()

  if (trimmed) {
    return trimmed
  }

  return EMPLOYEE_FORM_AREA_OPTIONS[0]
}
