import { hasWebModuleAccess } from "@/lib/roles/web-module-access"
import type { SessionUser } from "@/lib/auth/session"

export function canAccessGestionComercialModule(
  sessionUser: SessionUser | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "gestion_comercial")
}

export function resolveCommercialActorEmployeeId(
  sessionUser: SessionUser
): string | null {
  const employeeId = sessionUser.employeeId?.trim() ?? ""
  return employeeId || null
}
