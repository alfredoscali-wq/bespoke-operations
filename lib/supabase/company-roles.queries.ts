import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCompanyRoleInsert,
  mapCompanyRoleRowToRole,
  mapCompanyRoleUpdate,
} from "@/lib/supabase/company-roles.mapper"
import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import { resolveEffectiveModuleVisibility } from "@/lib/roles/role-utils"
import type { CompanyRole } from "@/lib/types/company-roles"

export type SupabaseCompanyRolesClient = SupabaseClient<Database>

export type CompanyRolesRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } }

function mapError(error: { message: string }): { message: string } {
  return { message: error.message }
}

export async function listCompanyRoles(
  client: SupabaseCompanyRolesClient,
  companyId: string
): Promise<CompanyRolesRepositoryResult<CompanyRole[]>> {
  const { data, error } = await client
    .from("company_roles")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapCompanyRoleRowToRole),
    error: null,
  }
}

export async function fetchCompanyRoleById(
  client: SupabaseCompanyRolesClient,
  id: string
): Promise<CompanyRolesRepositoryResult<CompanyRole>> {
  const { data, error } = await client
    .from("company_roles")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "Rol no encontrado." }),
    }
  }

  return { data: mapCompanyRoleRowToRole(data), error: null }
}

export async function createCompanyRole(
  client: SupabaseCompanyRolesClient,
  input: {
    companyId: string
    code: string
    name: string
    moduleVisibility: ModuleVisibilityMap
    sortOrder: number
  }
): Promise<CompanyRolesRepositoryResult<CompanyRole>> {
  const { data, error } = await client
    .from("company_roles")
    .insert(
      mapCompanyRoleInsert({
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        moduleVisibility: input.moduleVisibility,
        sortOrder: input.sortOrder,
        isSystem: false,
      })
    )
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo crear el rol." }),
    }
  }

  return { data: mapCompanyRoleRowToRole(data), error: null }
}

export async function updateCompanyRoleModules(
  client: SupabaseCompanyRolesClient,
  id: string,
  input: {
    code: string
    moduleVisibility: ModuleVisibilityMap
  }
): Promise<CompanyRolesRepositoryResult<CompanyRole>> {
  const effectiveVisibility = resolveEffectiveModuleVisibility({
    code: input.code,
    moduleVisibility: input.moduleVisibility,
  })

  const { data, error } = await client
    .from("company_roles")
    .update(
      mapCompanyRoleUpdate({
        moduleVisibility: effectiveVisibility,
      })
    )
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo actualizar el rol." }),
    }
  }

  return { data: mapCompanyRoleRowToRole(data), error: null }
}

export async function resolveNextCompanyRoleSortOrder(
  client: SupabaseCompanyRolesClient,
  companyId: string
): Promise<number> {
  const { data } = await client
    .from("company_roles")
    .select("sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.sort_order ?? 0) + 1
}

export async function countEmployeesWithRole(
  client: SupabaseCompanyRolesClient,
  roleId: string
): Promise<CompanyRolesRepositoryResult<number>> {
  const { count, error } = await client
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("role_id", roleId)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: count ?? 0, error: null }
}
