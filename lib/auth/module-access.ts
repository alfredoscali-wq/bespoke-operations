import type { AppModuleKey } from "@/lib/roles/app-modules"
import {
  normalizeModuleVisibility,
  resolveModuleKeyFromPathname,
} from "@/lib/roles/app-modules"
import { hasWebModuleAccessFromMetadata } from "@/lib/roles/web-module-access"
import type { SessionUser } from "@/lib/auth/types"
import { getDefaultPostLoginPath, PROFILE_PATH } from "@/lib/auth/routes"
import { isSystemRole } from "@/lib/auth/system-role"
import { resolveHomePathFromModuleVisibility } from "@/lib/navigation/build-nav-from-modules"
import type { SystemRole } from "@/lib/types/employees"

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
  const moduleKey = resolveModuleKeyFromPathname(pathname)

  if (!moduleKey) {
    return true
  }

  return hasWebModuleAccessFromMetadata(
    metadata,
    moduleKey,
    getMetadataSystemRoleFromUser(metadata)
  )
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

export function resolveModuleVisibilityFromMetadata(
  metadata: Record<string, unknown> | undefined
) {
  const allowedModules = getMetadataAllowedModules(metadata)

  if (!allowedModules) {
    return null
  }

  return normalizeModuleVisibility(
    Object.fromEntries(allowedModules.map((key) => [key, true]))
  )
}

export function resolvePostLoginPathFromAuthMetadata(
  systemRole: SystemRole | null | undefined,
  metadata: Record<string, unknown> | undefined
): string {
  if (systemRole === "operario") {
    return "/operario"
  }

  const visibility = resolveModuleVisibilityFromMetadata(metadata)

  if (!visibility) {
    return getDefaultPostLoginPath(systemRole)
  }

  return resolveHomePathFromModuleVisibility(visibility)
}

export function resolvePostLoginPathFromSessionUser(
  sessionUser: Pick<SessionUser, "systemRole" | "roleId" | "moduleVisibility">
): string {
  if (sessionUser.systemRole === "operario") {
    return "/operario"
  }

  if (!sessionUser.roleId) {
    return getDefaultPostLoginPath(sessionUser.systemRole)
  }

  return resolveHomePathFromModuleVisibility(sessionUser.moduleVisibility)
}

export function resolveAccessDeniedRedirectPath(
  systemRole: SystemRole | null | undefined,
  metadata: Record<string, unknown> | undefined,
  currentPathname: string
): string {
  const fallback = resolvePostLoginPathFromAuthMetadata(systemRole, metadata)

  if (fallback === currentPathname) {
    return PROFILE_PATH
  }

  return fallback
}
