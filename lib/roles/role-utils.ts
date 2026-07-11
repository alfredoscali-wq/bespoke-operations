import {
  mapAreaCodeToSystemRole,
  resolveFixedAreaCode,
} from "@/lib/roles/company-areas"
import type { SystemRole } from "@/lib/types/employees"
import {
  createFullModuleVisibility,
  normalizeModuleVisibility,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
import { slugifyCode } from "@/lib/utils/code-slug"

export const ADMINISTRATOR_ROLE_CODE = "administrador"

export function mapRoleCodeToSystemRole(code: string): SystemRole {
  return mapAreaCodeToSystemRole(code)
}

export function mapLegacyRoleCodeToAreaCode(code: string): string | null {
  return resolveFixedAreaCode(code)
}

export function resolveEffectiveModuleVisibility(input: {
  code: string
  moduleVisibility: Partial<ModuleVisibilityMap> | null | undefined
}): ModuleVisibilityMap {
  if (input.code === ADMINISTRATOR_ROLE_CODE) {
    return createFullModuleVisibility()
  }

  return normalizeModuleVisibility(input.moduleVisibility)
}

export function canManageRoles(
  roleCode: string | null | undefined,
  systemRole: SystemRole | null | undefined
): boolean {
  return (
    roleCode === ADMINISTRATOR_ROLE_CODE || systemRole === "administrador"
  )
}

export function getMetadataRoleCode(
  metadata: Record<string, unknown> | undefined
): string | null {
  return typeof metadata?.role_code === "string"
    ? metadata.role_code.trim() || null
    : null
}

/** Auth metadata/JWT: aligned with isAdministradorSessionUser semantics. */
export function isAdministradorAuthMetadata(
  metadata: Record<string, unknown> | undefined,
  systemRole: SystemRole | null | undefined = null
): boolean {
  const resolvedSystemRole =
    systemRole ??
    (typeof metadata?.system_role === "string" ? metadata.system_role : null)

  if (resolvedSystemRole === "administrador") {
    return true
  }

  return getMetadataRoleCode(metadata) === ADMINISTRATOR_ROLE_CODE
}

export function slugifyRoleCode(name: string): string {
  return slugifyCode(name, "rol")
}
