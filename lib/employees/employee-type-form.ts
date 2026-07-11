import type { EmployeeTypeCatalog } from "@/lib/types/employee-types"

export function buildEmployeeFormTypeOptions(
  catalog: EmployeeTypeCatalog[],
  currentTypeId?: string | null
) {
  const active = catalog.filter((item) => item.isActive)
  const options = active.map((item) => ({
    value: item.id,
    label: item.name,
    code: item.code,
  }))

  if (!currentTypeId) {
    return options
  }

  const current = catalog.find((item) => item.id === currentTypeId)
  if (!current || current.isActive) {
    return options
  }

  return [
    {
      value: current.id,
      label: current.name,
      code: current.code,
    },
    ...options.filter((option) => option.value !== current.id),
  ]
}

export function resolveDefaultEmployeeTypeId(
  catalog: EmployeeTypeCatalog[]
): string | null {
  const operator = catalog.find(
    (item) => item.isActive && item.code.trim().toLowerCase() === "operator"
  )

  if (operator) {
    return operator.id
  }

  const firstActive = catalog.find((item) => item.isActive)
  return firstActive?.id ?? null
}

export function buildEmployeeTypeFilterOptions(
  catalog: EmployeeTypeCatalog[],
  employees: Array<{ employeeTypeId?: string | null }>
) {
  const usedInactiveIds = new Set(
    employees
      .map((employee) => employee.employeeTypeId)
      .filter((id): id is string => Boolean(id))
  )

  return catalog
    .filter(
      (item) =>
        item.isActive || (item.id ? usedInactiveIds.has(item.id) : false)
    )
    .map((item) => ({
      value: item.id,
      label: item.name,
    }))
}
