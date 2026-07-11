import type { EmployeeType } from "@/lib/types/employees"
import type { EmployeeTypeCatalog } from "@/lib/types/employee-types"

export const STANDARD_EMPLOYEE_TYPE_CODES = [
  "supervisor",
  "administrative",
  "operator",
] as const

export const LEGACY_EMPLOYEE_TYPE_CODES = ["manager", "other"] as const

export type EmployeeTypeCatalogCode =
  | (typeof STANDARD_EMPLOYEE_TYPE_CODES)[number]
  | (typeof LEGACY_EMPLOYEE_TYPE_CODES)[number]
  | string

const LEGACY_ENUM_BY_CATALOG_CODE: Record<string, EmployeeType> = {
  operator: "operario",
  supervisor: "supervisor",
  administrative: "administrativo",
  manager: "gerente",
  other: "otro",
}

const CATALOG_CODE_BY_LEGACY_ENUM: Record<EmployeeType, EmployeeTypeCatalogCode> =
  {
    operario: "operator",
    supervisor: "supervisor",
    administrativo: "administrative",
    gerente: "manager",
    otro: "other",
  }

export function resolveLegacyEmployeeTypeFromCatalogCode(
  code: string
): EmployeeType {
  return LEGACY_ENUM_BY_CATALOG_CODE[code.trim().toLowerCase()] ?? "otro"
}

export function resolveCatalogCodeFromLegacyEmployeeType(
  employeeType: EmployeeType
): EmployeeTypeCatalogCode {
  return CATALOG_CODE_BY_LEGACY_ENUM[employeeType]
}

export function resolveEmployeeTypePersistence(input: {
  employeeTypeId?: string | null
  employeeType?: EmployeeType
  catalog: EmployeeTypeCatalog[]
}): {
  employeeTypeId: string | null
  employeeType: EmployeeType
} {
  if (input.employeeTypeId) {
    const record = input.catalog.find((item) => item.id === input.employeeTypeId)

    if (record) {
      return {
        employeeTypeId: record.id,
        employeeType: resolveLegacyEmployeeTypeFromCatalogCode(record.code),
      }
    }
  }

  const legacyType = input.employeeType ?? "operario"
  const code = resolveCatalogCodeFromLegacyEmployeeType(legacyType)
  const record = input.catalog.find(
    (item) => item.code.trim().toLowerCase() === String(code).toLowerCase()
  )

  return {
    employeeTypeId: record?.id ?? null,
    employeeType: legacyType,
  }
}

export function getEmployeeTypeDisplayName(input: {
  employeeType: EmployeeType
  employeeTypeRecord?: Pick<EmployeeTypeCatalog, "name"> | null
}): string {
  if (input.employeeTypeRecord?.name?.trim()) {
    return input.employeeTypeRecord.name.trim()
  }

  const labels: Record<EmployeeType, string> = {
    operario: "Operario",
    supervisor: "Supervisor",
    administrativo: "Administrativo",
    gerente: "Gerente",
    otro: "Otro",
  }

  return labels[input.employeeType]
}

export function isSupervisorEmployeeType(input: {
  employeeType: EmployeeType
  employeeTypeRecord?: Pick<EmployeeTypeCatalog, "code"> | null
}): boolean {
  if (input.employeeTypeRecord?.code?.trim().toLowerCase() === "supervisor") {
    return true
  }

  return input.employeeType === "supervisor"
}
