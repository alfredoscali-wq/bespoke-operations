import {
  getVisibleModuleKeys,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
import { resolveEffectiveModuleVisibility } from "@/lib/roles/role-utils"
import type { CompanyRole, SessionRoleContext } from "@/lib/types/company-roles"
import type { Employee } from "@/lib/types/employees"

export function buildSessionRoleContext(input: {
  employee: Pick<Employee, "roleId"> | null
  role: CompanyRole | null
}): SessionRoleContext {
  if (!input.role) {
    return {
      roleId: input.employee?.roleId ?? null,
      roleCode: null,
      roleName: null,
      moduleVisibility: resolveEffectiveModuleVisibility({
        code: "operario",
        moduleVisibility: {},
      }),
      visibleModuleKeys: [],
    }
  }

  const moduleVisibility = resolveEffectiveModuleVisibility({
    code: input.role.code,
    moduleVisibility: input.role.moduleVisibility,
  })

  return {
    roleId: input.role.id,
    roleCode: input.role.code,
    roleName: input.role.name,
    moduleVisibility,
    visibleModuleKeys: getVisibleModuleKeys(moduleVisibility),
  }
}

export function serializeModuleVisibilityForMetadata(
  visibility: ModuleVisibilityMap
): string[] {
  return getVisibleModuleKeys(visibility)
}
