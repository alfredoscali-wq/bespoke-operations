import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapEmployeeTypeInsert,
  mapEmployeeTypeRowToItem,
  mapEmployeeTypeUpdate,
} from "@/lib/supabase/employee-types.mapper"
import type {
  EmployeeTypeCatalog,
  EmployeeTypeCatalogInput,
} from "@/lib/types/employee-types"

export type SupabaseEmployeeTypesClient = SupabaseClient<Database>

export type EmployeeTypesRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } }

function mapError(error: { message: string }): { message: string } {
  return { message: error.message }
}

export async function listEmployeeTypes(
  client: SupabaseEmployeeTypesClient,
  companyId: string
): Promise<EmployeeTypesRepositoryResult<EmployeeTypeCatalog[]>> {
  const { data, error } = await client
    .from("employee_types")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapEmployeeTypeRowToItem),
    error: null,
  }
}

export async function listActiveEmployeeTypes(
  client: SupabaseEmployeeTypesClient,
  companyId: string
): Promise<EmployeeTypesRepositoryResult<EmployeeTypeCatalog[]>> {
  const { data, error } = await client
    .from("employee_types")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapEmployeeTypeRowToItem),
    error: null,
  }
}

export async function fetchEmployeeTypeById(
  client: SupabaseEmployeeTypesClient,
  companyId: string,
  id: string
): Promise<EmployeeTypesRepositoryResult<EmployeeTypeCatalog>> {
  const { data, error } = await client
    .from("employee_types")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { message: "Tipo de empleado no encontrado." },
    }
  }

  return { data: mapEmployeeTypeRowToItem(data), error: null }
}

export async function createEmployeeType(
  client: SupabaseEmployeeTypesClient,
  input: {
    companyId: string
    code: string
    sortOrder: number
    item: EmployeeTypeCatalogInput
  }
): Promise<EmployeeTypesRepositoryResult<EmployeeTypeCatalog>> {
  const { data, error } = await client
    .from("employee_types")
    .insert(
      mapEmployeeTypeInsert({
        companyId: input.companyId,
        code: input.code,
        sortOrder: input.sortOrder,
        item: input.item,
      })
    )
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(
        error ?? { message: "No se pudo crear el tipo de empleado." }
      ),
    }
  }

  return { data: mapEmployeeTypeRowToItem(data), error: null }
}

export async function updateEmployeeType(
  client: SupabaseEmployeeTypesClient,
  id: string,
  input: Partial<EmployeeTypeCatalogInput>
): Promise<EmployeeTypesRepositoryResult<EmployeeTypeCatalog>> {
  const { data, error } = await client
    .from("employee_types")
    .update(mapEmployeeTypeUpdate(input))
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(
        error ?? { message: "No se pudo actualizar el tipo de empleado." }
      ),
    }
  }

  return { data: mapEmployeeTypeRowToItem(data), error: null }
}

export async function resolveNextEmployeeTypeSortOrder(
  client: SupabaseEmployeeTypesClient,
  companyId: string
): Promise<number> {
  const { data } = await client
    .from("employee_types")
    .select("sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.sort_order ?? 0) + 1
}

export async function countEmployeeTypeUsage(
  client: SupabaseEmployeeTypesClient,
  companyId: string,
  employeeTypeId: string
): Promise<EmployeeTypesRepositoryResult<number>> {
  const { count, error } = await client
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("employee_type_id", employeeTypeId)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: count ?? 0, error: null }
}
