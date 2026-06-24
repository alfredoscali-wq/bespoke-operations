import type { AppUserRole } from "@/lib/auth/current-user"
import { formatSystemRole } from "@/lib/auth/format-system-role"
import type { SessionUser } from "@/lib/auth/types"
import type { SystemRole } from "@/lib/types/employees"

export const AUTH_DISPLAY_FALLBACK = {
  displayName: "Usuario",
  initials: "US",
  systemRole: null as SystemRole | null,
  roleLabel: "Sin sesión",
} as const

export type AuthDisplay = {
  displayName: string
  initials: string
  systemRole: SystemRole | null
  roleLabel: string
}

export function resolveAuthDisplay(sessionUser: SessionUser | null): AuthDisplay {
  if (!sessionUser) {
    return { ...AUTH_DISPLAY_FALLBACK }
  }

  return {
    displayName: sessionUser.displayName.trim() || AUTH_DISPLAY_FALLBACK.displayName,
    initials: sessionUser.initials.trim() || AUTH_DISPLAY_FALLBACK.initials,
    systemRole: sessionUser.systemRole,
    roleLabel: sessionUser.systemRole
      ? formatSystemRole(sessionUser.systemRole)
      : AUTH_DISPLAY_FALLBACK.roleLabel,
  }
}

export function resolveEvidenceActor(sessionUser: SessionUser | null): {
  name: string
  role: AppUserRole
} {
  const display = resolveAuthDisplay(sessionUser)

  return {
    name: display.displayName,
    role: display.systemRole ?? "administrativo",
  }
}
