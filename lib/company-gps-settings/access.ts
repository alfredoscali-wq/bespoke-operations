import type { SessionUser } from "@/lib/auth/types"
import { isAdministradorSessionUser } from "@/lib/roles/web-module-access"

export function canManageCompanyGpsSettings(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode"> | null | undefined
): boolean {
  return isAdministradorSessionUser(sessionUser)
}

export function canReadCompanyGpsSettings(
  sessionUser: Pick<SessionUser, "companyId"> | null | undefined
): boolean {
  return Boolean(sessionUser?.companyId?.trim())
}
