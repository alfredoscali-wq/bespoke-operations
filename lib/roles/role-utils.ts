import type { SystemRole } from "@/lib/types/employees"
import {
  createFullModuleVisibility,
  normalizeModuleVisibility,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"

export const ADMINISTRATOR_ROLE_CODE = "administrador"

export function mapRoleCodeToSystemRole(code: string): SystemRole {
  switch (code) {
    case "administrador":
      return "administrador"
    case "supervisor":
      return "supervisor"
    case "operario":
      return "operario"
    case "administrativo":
    case "rrhh":
    default:
      return "administrativo"
  }
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

export function slugifyRoleCode(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)

  return slug || "rol"
}
