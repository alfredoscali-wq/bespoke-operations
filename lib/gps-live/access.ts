import type { SessionUser } from "@/lib/auth/types"
import {
  canAccessPlanningWebModule,
  isAdministradorSessionUser,
} from "@/lib/roles/web-module-access"

export function canViewOperationsLiveMap(
  sessionUser: SessionUser | null | undefined
): boolean {
  if (!sessionUser) {
    return false
  }
  return (
    isAdministradorSessionUser(sessionUser) ||
    sessionUser.systemRole === "supervisor" ||
    canAccessPlanningWebModule(sessionUser)
  )
}
