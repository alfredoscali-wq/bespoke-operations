import type { Database } from "@/lib/supabase/database.types"
import {
  normalizeModuleVisibility,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
import { resolveEffectiveModuleVisibility } from "@/lib/roles/role-utils"
import type { CompanyRole } from "@/lib/types/company-roles"

export type CompanyRoleRow = Database["public"]["Tables"]["company_roles"]["Row"]
export type CompanyRoleInsert =
  Database["public"]["Tables"]["company_roles"]["Insert"]
export type CompanyRoleUpdate =
  Database["public"]["Tables"]["company_roles"]["Update"]

function mapModuleVisibility(
  code: string,
  value: Database["public"]["Tables"]["company_roles"]["Row"]["module_visibility"]
): ModuleVisibilityMap {
  const parsed =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<ModuleVisibilityMap>)
      : undefined

  return resolveEffectiveModuleVisibility({
    code,
    moduleVisibility: parsed,
  })
}

export function mapCompanyRoleRowToRole(row: CompanyRoleRow): CompanyRole {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    isSystem: row.is_system,
    moduleVisibility: mapModuleVisibility(row.code, row.module_visibility),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCompanyRoleInsert(input: {
  companyId: string
  code: string
  name: string
  isSystem?: boolean
  moduleVisibility: ModuleVisibilityMap
  sortOrder: number
}): CompanyRoleInsert {
  return {
    company_id: input.companyId,
    code: input.code,
    name: input.name.trim(),
    is_system: input.isSystem ?? false,
    module_visibility: normalizeModuleVisibility(input.moduleVisibility),
    sort_order: input.sortOrder,
  }
}

export function mapCompanyRoleUpdate(input: {
  name?: string
  moduleVisibility?: ModuleVisibilityMap
  sortOrder?: number | null
}): CompanyRoleUpdate {
  const update: CompanyRoleUpdate = {}

  if (input.name !== undefined) {
    update.name = input.name.trim()
  }
  if (input.moduleVisibility !== undefined) {
    update.module_visibility = normalizeModuleVisibility(input.moduleVisibility)
  }
  if (input.sortOrder !== undefined && input.sortOrder !== null) {
    update.sort_order = input.sortOrder
  }

  return update
}

export function mapCompanyRoleRowToSummary(
  row: Pick<CompanyRoleRow, "id" | "code" | "name" | "is_system">
) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isSystem: row.is_system,
  }
}
