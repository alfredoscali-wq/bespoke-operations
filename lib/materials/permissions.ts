import {
  canAccessPathWithModules,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
import type { SessionUser } from "@/lib/auth/session"

export function canAccessMaterialsModule(
  sessionUser: Pick<SessionUser, "moduleVisibility">
): boolean {
  return canAccessPathWithModules(
    "/materiales",
    sessionUser.moduleVisibility as ModuleVisibilityMap
  )
}

export function canManageMaterials(
  sessionUser: Pick<SessionUser, "moduleVisibility">
): boolean {
  return canAccessMaterialsModule(sessionUser)
}
