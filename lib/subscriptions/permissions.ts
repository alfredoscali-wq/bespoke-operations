import type { SystemRole } from "@/lib/types/employees"

/** Write access: Administrador + Administración (matches RLS). */
export function canWriteSubscriptions(
  role: SystemRole | null | undefined
): boolean {
  return role === "administrador" || role === "administrativo"
}
