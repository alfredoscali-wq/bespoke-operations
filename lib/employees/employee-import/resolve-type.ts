import {
  resolveCatalogCodeFromLegacyEmployeeType,
  resolveLegacyEmployeeTypeFromCatalogCode,
} from "@/lib/employees/employee-type-legacy"
import {
  resolveImportEmployeeType,
} from "@/lib/employees/employee-import/normalize"
import type { EmployeeType } from "@/lib/types/employees"
import type { EmployeeTypeCatalog } from "@/lib/types/employee-types"

function normalizeLookupText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export type ResolvedImportEmployeeType = {
  employeeTypeId: string
  employeeType: EmployeeType
  displayName: string
}

export function resolveImportEmployeeTypeFromCatalog(
  rawValue: string,
  catalog: EmployeeTypeCatalog[]
): ResolvedImportEmployeeType | null {
  const raw = rawValue.trim()
  if (!raw) {
    return null
  }

  const normalized = normalizeLookupText(raw)

  const byCode = catalog.find(
    (item) => normalizeLookupText(item.code) === normalized
  )
  if (byCode) {
    return {
      employeeTypeId: byCode.id,
      employeeType: resolveLegacyEmployeeTypeFromCatalogCode(byCode.code),
      displayName: byCode.name,
    }
  }

  const legacyType = resolveImportEmployeeType(raw)
  if (legacyType) {
    const legacyCode = resolveCatalogCodeFromLegacyEmployeeType(legacyType)
    const byLegacy = catalog.find(
      (item) => normalizeLookupText(item.code) === normalizeLookupText(String(legacyCode))
    )

    if (byLegacy) {
      return {
        employeeTypeId: byLegacy.id,
        employeeType: legacyType,
        displayName: byLegacy.name,
      }
    }
  }

  const nameMatches = catalog.filter(
    (item) => normalizeLookupText(item.name) === normalized
  )

  if (nameMatches.length === 1) {
    const match = nameMatches[0]
    return {
      employeeTypeId: match.id,
      employeeType: resolveLegacyEmployeeTypeFromCatalogCode(match.code),
      displayName: match.name,
    }
  }

  return null
}
