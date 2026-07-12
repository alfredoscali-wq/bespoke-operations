import { hasWebModuleAccess } from "@/lib/roles/web-module-access"
import type { SessionUser } from "@/lib/auth/session"

export function canAccessAtencionClienteModule(
  sessionUser: SessionUser | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "atencion_cliente")
}

export function resolveAtencionClienteActorEmployeeId(
  sessionUser: SessionUser
): string | null {
  const employeeId = sessionUser.employeeId?.trim() ?? ""
  return employeeId || null
}
