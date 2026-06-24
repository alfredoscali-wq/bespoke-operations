import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import type { SessionUser } from "@/lib/auth/types"
import type { SystemRole } from "@/lib/types/employees"

export type OperarioIdentity = {
  displayName: string
  initials: string
  roleLabel: string
  systemRole: SystemRole | null
}

export function resolveOperarioIdentity(
  sessionUser: SessionUser | null
): OperarioIdentity {
  const display = resolveAuthDisplay(sessionUser)

  return {
    displayName: display.displayName,
    initials: display.initials,
    roleLabel: display.roleLabel,
    systemRole: display.systemRole,
  }
}
