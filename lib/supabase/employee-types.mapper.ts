import type { Database } from "@/lib/supabase/database.types"
import type {
  EmployeeTypeCatalog,
  EmployeeTypeCatalogInput,
} from "@/lib/types/employee-types"

export type EmployeeTypeRow = Database["public"]["Tables"]["employee_types"]["Row"]
export type EmployeeTypeInsert =
  Database["public"]["Tables"]["employee_types"]["Insert"]
export type EmployeeTypeUpdate =
  Database["public"]["Tables"]["employee_types"]["Update"]

export type EmployeeTypeJoinedRow = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export function mapEmployeeTypeRowToItem(row: EmployeeTypeRow): EmployeeTypeCatalog {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapEmployeeTypeJoinedRow(
  row: EmployeeTypeJoinedRow | null
): Pick<EmployeeTypeCatalog, "id" | "code" | "name" | "isActive"> | null {
  if (!row) return null

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
  }
}

export function mapEmployeeTypeInsert(input: {
  companyId: string
  code: string
  sortOrder: number
  item: EmployeeTypeCatalogInput
}): EmployeeTypeInsert {
  return {
    company_id: input.companyId,
    code: input.code,
    name: input.item.name.trim(),
    description: input.item.description.trim() || null,
    is_active: input.item.isActive,
    sort_order: input.sortOrder,
  }
}

export function mapEmployeeTypeUpdate(
  input: Partial<EmployeeTypeCatalogInput>
): EmployeeTypeUpdate {
  const update: EmployeeTypeUpdate = {}

  if (input.name !== undefined) {
    update.name = input.name.trim()
  }
  if (input.description !== undefined) {
    update.description = input.description.trim() || null
  }
  if (input.isActive !== undefined) {
    update.is_active = input.isActive
  }

  return update
}
