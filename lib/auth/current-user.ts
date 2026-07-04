import { formatAppUserRole } from "@/lib/auth/format-system-role"
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

export { formatAppUserRole }
