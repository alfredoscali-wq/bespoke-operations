import { createClient } from "@/lib/supabase/client"
import { resolveUniqueRoleCode } from "@/lib/roles/role-code"
import {
  createCompanyRole,
  fetchCompanyRoleById,
  listCompanyRoles,
  resolveNextCompanyRoleSortOrder,
  updateCompanyRoleModules,
  type SupabaseCompanyRolesClient,
} from "@/lib/supabase/company-roles.queries"
import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import type { CompanyRole } from "@/lib/types/company-roles"

export function createBrowserCompanyRolesClient(): SupabaseCompanyRolesClient {
  return createClient()
}

export async function fetchCompanyRoles(
  companyId: string,
  client: SupabaseCompanyRolesClient = createBrowserCompanyRolesClient()
) {
  return listCompanyRoles(client, companyId)
}

export async function fetchCompanyRole(
  roleId: string,
  client: SupabaseCompanyRolesClient = createBrowserCompanyRolesClient()
) {
  return fetchCompanyRoleById(client, roleId)
}

export async function addCompanyRole(
  companyId: string,
  input: {
    name: string
    copyFromRoleId: string
  },
  existingCodes: string[],
  client: SupabaseCompanyRolesClient = createBrowserCompanyRolesClient()
): Promise<
  | { success: true; role: CompanyRole }
  | { success: false; message: string }
> {
  const templateResult = await fetchCompanyRoleById(client, input.copyFromRoleId)

  if (templateResult.error || !templateResult.data) {
    return {
      success: false,
      message:
        templateResult.error?.message ??
        "No se pudo copiar la configuración del rol seleccionado.",
    }
  }

  const code = resolveUniqueRoleCode(input.name, existingCodes)
  const sortOrder = await resolveNextCompanyRoleSortOrder(client, companyId)

  const result = await createCompanyRole(client, {
    companyId,
    code,
    name: input.name,
    moduleVisibility: templateResult.data.moduleVisibility,
    sortOrder,
  })

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "No se pudo crear el rol.",
    }
  }

  return { success: true, role: result.data }
}

export async function saveCompanyRoleModules(
  role: Pick<CompanyRole, "id" | "code">,
  moduleVisibility: ModuleVisibilityMap,
  client: SupabaseCompanyRolesClient = createBrowserCompanyRolesClient()
): Promise<
  | { success: true; role: CompanyRole }
  | { success: false; message: string }
> {
  const result = await updateCompanyRoleModules(client, role.id, {
    code: role.code,
    moduleVisibility,
  })

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "No se pudo guardar el rol.",
    }
  }

  return { success: true, role: result.data }
}
