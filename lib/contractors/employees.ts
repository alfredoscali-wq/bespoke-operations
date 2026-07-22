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

export function buildNextExternalEmployeeCode(existingCodes: string[]): string {
  let max = 0
  for (const code of existingCodes) {
    const match = /^EXT-(\d+)$/i.exec(code.trim())
    if (!match) continue
    const value = Number(match[1])
    if (Number.isFinite(value) && value > max) max = value
  }
  return `EXT-${String(max + 1).padStart(4, "0")}`
}
