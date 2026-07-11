import { createClient } from "@/lib/supabase/client"
import { resolveUniqueEmployeeTypeCode } from "@/lib/employee-types/slugify"
import {
  countEmployeeTypeUsage,
  createEmployeeType,
  listEmployeeTypes,
  resolveNextEmployeeTypeSortOrder,
  updateEmployeeType,
  type SupabaseEmployeeTypesClient,
} from "@/lib/supabase/employee-types.queries"
import type {
  EmployeeTypeCatalog,
  EmployeeTypeCatalogInput,
} from "@/lib/types/employee-types"

export function createBrowserEmployeeTypesClient(): SupabaseEmployeeTypesClient {
  return createClient()
}

export async function fetchEmployeeTypes(
  companyId: string,
  client: SupabaseEmployeeTypesClient = createBrowserEmployeeTypesClient()
) {
  return listEmployeeTypes(client, companyId)
}

export async function addEmployeeType(
  companyId: string,
  item: EmployeeTypeCatalogInput,
  existingCodes: string[],
  client: SupabaseEmployeeTypesClient = createBrowserEmployeeTypesClient()
): Promise<
  | { success: true; item: EmployeeTypeCatalog }
  | { success: false; message: string }
> {
  const code = resolveUniqueEmployeeTypeCode(item.name, existingCodes)
  const sortOrder = await resolveNextEmployeeTypeSortOrder(client, companyId)

  const result = await createEmployeeType(client, {
    companyId,
    code,
    sortOrder,
    item,
  })

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "No se pudo crear el tipo de empleado.",
    }
  }

  return { success: true, item: result.data }
}

export async function saveEmployeeType(
  id: string,
  input: Partial<EmployeeTypeCatalogInput>,
  client: SupabaseEmployeeTypesClient = createBrowserEmployeeTypesClient()
): Promise<
  | { success: true; item: EmployeeTypeCatalog }
  | { success: false; message: string }
> {
  const result = await updateEmployeeType(client, id, input)

  if (result.error || !result.data) {
    return {
      success: false,
      message:
        result.error?.message ?? "No se pudo guardar el tipo de empleado.",
    }
  }

  return { success: true, item: result.data }
}

export async function fetchEmployeeTypeUsageCount(
  companyId: string,
  employeeTypeId: string,
  client: SupabaseEmployeeTypesClient = createBrowserEmployeeTypesClient()
): Promise<
  | { success: true; count: number }
  | { success: false; message: string }
> {
  const result = await countEmployeeTypeUsage(client, companyId, employeeTypeId)

  if (result.error || result.data === null) {
    return {
      success: false,
      message:
        result.error?.message ??
        "No se pudo verificar el uso del tipo de empleado.",
    }
  }

  return { success: true, count: result.data }
}
