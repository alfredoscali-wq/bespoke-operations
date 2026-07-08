import { EMPLOYEE_TYPE_LABELS } from "@/lib/employees/constants"
import type { EmployeeType } from "@/lib/types/employees"

export const EMPLOYEE_FORM_AREA_OPTIONS = [
  "Administración",
  "Atención al Cliente",
  "Ventas",
  "RRHH",
  "Técnica",
  "Operario",
] as const

export type EmployeeFormAreaOption = (typeof EMPLOYEE_FORM_AREA_OPTIONS)[number]

export const EMPLOYEE_FORM_TYPE_OPTIONS = [
  { value: "administrativo" as const, label: "Administrativo" },
  { value: "operario" as const, label: "Operario" },
] as const

const LEGACY_EMPLOYEE_FORM_TYPE_VALUES = new Set<EmployeeType>([
  "supervisor",
  "gerente",
  "otro",
])

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

export function buildEmployeeFormTypeOptions(currentType?: EmployeeType) {
  const base = EMPLOYEE_FORM_TYPE_OPTIONS.map((option) => ({ ...option }))

  if (currentType && LEGACY_EMPLOYEE_FORM_TYPE_VALUES.has(currentType)) {
    return [
      { value: currentType, label: EMPLOYEE_TYPE_LABELS[currentType] },
      ...base,
    ]
  }

  return base
}

export function isLegacyEmployeeFormType(type: EmployeeType): boolean {
  return LEGACY_EMPLOYEE_FORM_TYPE_VALUES.has(type)
}
