import type { SystemRole } from "@/lib/types/employees"

/** Write access: Administrador + Administración. */
export function canWriteTreasury(role: SystemRole | null | undefined): boolean {
  return role === "administrador" || role === "administrativo"
}

/**
 * Hard delete is Administrador-only (maintenance / test cleanup).
 * Administración, Supervisor and Operario must not permanently delete.
 */
export function canHardDeleteTreasury(
  role: SystemRole | null | undefined
): boolean {
  return role === "administrador"
}
