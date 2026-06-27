import { BESPOKE_DEMO_COMPANY_ID } from "@/lib/demo/constants"
import type { SessionUser } from "@/lib/auth/types"
import type { SystemRole } from "@/lib/types/employees"

export function isDemoSystemRole(
  systemRole: SystemRole | null | undefined
): boolean {
  return systemRole === "demo"
}

export function isDemoCompanyId(companyId: string | null | undefined): boolean {
  return companyId === BESPOKE_DEMO_COMPANY_ID
}

/**
 * Usuario en modo demostración: rol demo o miembro de la empresa Bespoke Demo.
 * Las mutaciones quedan bloqueadas con diálogo amigable (sin errores de permisos).
 */
export function isDemoPlatformReadOnlyUser(
  user: Pick<SessionUser, "systemRole" | "companyId"> | null | undefined
): boolean {
  if (!user) {
    return false
  }

  if (isDemoSystemRole(user.systemRole)) {
    return true
  }

  return isDemoCompanyId(user.companyId)
}

export function shouldShowDemoBanner(
  user: Pick<SessionUser, "systemRole" | "companyId"> | null | undefined
): boolean {
  return isDemoPlatformReadOnlyUser(user)
}
