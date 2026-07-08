import { getMetadataAllowedModules } from "@/lib/auth/module-access"
import type { SessionUser } from "@/lib/auth/types"
import type { AppModuleKey } from "@/lib/roles/app-modules"
import { ADMINISTRATOR_ROLE_CODE } from "@/lib/roles/role-utils"
import type { SystemRole } from "@/lib/types/employees"

export function isAdministradorSessionUser(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode"> | null | undefined
): boolean {
  return (
    sessionUser?.systemRole === "administrador" ||
    sessionUser?.roleCode === ADMINISTRATOR_ROLE_CODE
  )
}

export function hasWebModuleAccess(
  sessionUser:
    | Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility">
    | null
    | undefined,
  moduleKey: AppModuleKey
): boolean {
  if (!sessionUser) {
    return false
  }

  if (isAdministradorSessionUser(sessionUser)) {
    return true
  }

  return sessionUser.moduleVisibility[moduleKey] === true
}

export function hasWebModuleAccessFromMetadata(
  metadata: Record<string, unknown> | undefined,
  moduleKey: AppModuleKey,
  systemRole: SystemRole | null | undefined = null
): boolean {
  if (systemRole === "administrador") {
    return true
  }

  const allowedModules = getMetadataAllowedModules(metadata)

  if (allowedModules) {
    return allowedModules.includes(moduleKey)
  }

  if (moduleKey === "planificacion") {
    return systemRole === "supervisor"
  }

  return true
}

export function canAccessPlanningWebModule(
  sessionUser: SessionUser | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "planificacion")
}

export function canUsePlanningWebOperationalActions(
  sessionUser: SessionUser | null | undefined
): boolean {
  return canAccessPlanningWebModule(sessionUser)
}

export function canUseWorkOrdersWebOperationalActions(
  sessionUser: SessionUser | null | undefined
): boolean {
  return (
    hasWebModuleAccess(sessionUser, "work_orders") ||
    hasWebModuleAccess(sessionUser, "planificacion")
  )
}

export function canAccessSettingsConfigWebModule(
  sessionUser: SessionUser | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "settings")
}

export function canManageCompanyAreasWeb(
  sessionUser: SessionUser | null | undefined
): boolean {
  return isAdministradorSessionUser(sessionUser)
}

export function canAccessPlanificacionFromAuthMetadata(
  metadata: Record<string, unknown> | undefined,
  systemRole: SystemRole | null | undefined
): boolean {
  return hasWebModuleAccessFromMetadata(metadata, "planificacion", systemRole)
}
