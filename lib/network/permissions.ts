import type { SessionUser } from "@/lib/auth/types"
import { hasWebModuleAccess } from "@/lib/roles/web-module-access"

export function canAccessNetworkModule(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "network")
}

export function canWriteNetworkModule(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return canAccessNetworkModule(sessionUser)
}
