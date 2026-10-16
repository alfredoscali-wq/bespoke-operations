import { canAccessSettingsConfigWebModule } from "@/lib/roles/web-module-access"
import type { SessionUser } from "@/lib/auth/types"

export function canManageMikrotikIntegrations(
  sessionUser: SessionUser | null | undefined
): boolean {
  return canAccessSettingsConfigWebModule(sessionUser)
}

export function resolveSessionCompanyId(
  sessionUser: Pick<SessionUser, "companyId"> | null | undefined
): string | null {
  const companyId = sessionUser?.companyId?.trim() ?? ""
  return companyId.length > 0 ? companyId : null
}
