import type { AppModuleKey } from "@/lib/roles/app-modules"
import {
  canAccessPathWithModules,
  normalizeModuleVisibility,
  resolveModuleKeyFromPathname,
} from "@/lib/roles/app-modules"
import { isSystemRole } from "@/lib/auth/system-role"

export function getMetadataAllowedModules(
  metadata: Record<string, unknown> | undefined
): AppModuleKey[] | null {
  const allowed = metadata?.allowed_modules

  if (!Array.isArray(allowed)) {
    return null
  }

  return allowed.filter(
    (value): value is AppModuleKey => typeof value === "string"
  )
}

export function canAccessPathWithMetadata(
  pathname: string,
  metadata: Record<string, unknown> | undefined
): boolean {
  const allowedModules = getMetadataAllowedModules(metadata)

  if (!allowedModules) {
    return true
  }

  const moduleKey = resolveModuleKeyFromPathname(pathname)

  if (!moduleKey) {
    return true
  }

  const visibility = normalizeModuleVisibility(
    Object.fromEntries(allowedModules.map((key) => [key, true]))
  )

  return canAccessPathWithModules(pathname, visibility)
}

export function getMetadataRoleId(
  metadata: Record<string, unknown> | undefined
): string | null {
  return typeof metadata?.role_id === "string" ? metadata.role_id : null
}

export function getMetadataSystemRoleFromUser(
  metadata: Record<string, unknown> | undefined
) {
  const role = metadata?.system_role
  return isSystemRole(role) ? role : null
}
