import { formatSystemRole } from "@/lib/auth/format-system-role"
import type { SystemRole } from "@/lib/types/employees"

/** Legacy roles still present in historical evidence records. */
export type LegacyAppUserRole = "coordinador"

/** Role stored on evidence events — current system roles plus legacy values. */
export type AppUserRole = SystemRole | LegacyAppUserRole

export type AppUser = {
  id: string
  name: string
  initials: string
  role: AppUserRole
  roleLabel: string
}

/** @deprecated Use SystemRole labels via formatSystemRole() instead. */
export const APP_USER_ROLE_LABELS: Record<AppUserRole, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  supervisor: "Supervisor",
  administrativo: "Administrativo",
  operario: "Operario",
}

/**
 * @deprecated Use SessionUser via useAuth() and resolveAuthDisplay() instead.
 * Kept temporarily for backward compatibility with unmigrated code paths.
 */
export const DASHBOARD_USER: AppUser = {
  id: "user-maria-gonzalez",
  name: "María González",
  initials: "MG",
  role: "coordinador",
  roleLabel: "Coordinadora de Operaciones",
}

export function formatAppUserRole(role: AppUserRole): string {
  if (role === "coordinador") {
    return APP_USER_ROLE_LABELS.coordinador
  }

  return formatSystemRole(role)
}
